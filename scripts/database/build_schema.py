"""Build the active schema from draw.io. The previous PRD expansion is archived."""
from erd_databases import build

if __name__ == "__main__":
    models = build()
    for database, tables in models.items():
        print(f"{database}: {len(tables)} tables from draw.io")
