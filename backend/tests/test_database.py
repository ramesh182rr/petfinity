from alembic import command
from alembic.script import ScriptDirectory
from sqlalchemy import Engine, create_engine, text
from sqlalchemy.orm import Session

from tests.conftest import alembic_config


def _extensions(engine: Engine) -> set[str]:
    with engine.connect() as conn:
        return set(conn.execute(text("SELECT extname FROM pg_extension")).scalars())


def _current_revision(engine: Engine) -> str | None:
    with engine.connect() as conn:
        exists = conn.execute(text("SELECT to_regclass('alembic_version')")).scalar()
        if exists is None:
            return None
        return conn.execute(text("SELECT version_num FROM alembic_version")).scalar()


def test_session_executes_queries(db_session: Session) -> None:
    assert db_session.execute(text("SELECT 1")).scalar() == 1


def test_session_changes_are_rolled_back(db_session: Session, db_engine: Engine) -> None:
    db_session.execute(text("CREATE TABLE _rollback_probe (id int)"))
    db_session.commit()  # even an explicit commit stays inside the outer test transaction

    with db_engine.connect() as other:
        assert other.execute(text("SELECT to_regclass('_rollback_probe')")).scalar() is None


def test_database_is_at_migration_head(migrated_database: str) -> None:
    head = ScriptDirectory.from_config(alembic_config()).get_current_head()
    engine = create_engine(migrated_database)
    try:
        assert _current_revision(engine) == head
        assert {"citext", "btree_gist"} <= _extensions(engine)
    finally:
        engine.dispose()


def test_migrations_downgrade_and_upgrade_cleanly(migrated_database: str) -> None:
    config = alembic_config(migrated_database)
    engine = create_engine(migrated_database)
    try:
        command.downgrade(config, "base")
        assert _current_revision(engine) is None
        assert not {"citext", "btree_gist"} & _extensions(engine)

        command.upgrade(config, "head")
        assert {"citext", "btree_gist"} <= _extensions(engine)
    finally:
        engine.dispose()


def test_models_and_migrations_in_sync(migrated_database: str) -> None:
    """Fails if a model changed without a matching Alembic migration."""
    from alembic.autogenerate import compare_metadata
    from alembic.runtime.migration import MigrationContext

    from app.db.registry import Base

    engine = create_engine(migrated_database)
    try:
        with engine.connect() as conn:
            diff = compare_metadata(MigrationContext.configure(conn), Base.metadata)
    finally:
        engine.dispose()
    assert diff == []
