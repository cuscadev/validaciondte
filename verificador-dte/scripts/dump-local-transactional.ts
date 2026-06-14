import pg from 'pg';

const LOCAL_URL =
  process.env.LOCAL_DATABASE_URL ||
  'postgres://facturacion:facturacion123@localhost:5433/facturacion?sslmode=disable';

async function main() {
  const pool = new pg.Pool({ connectionString: LOCAL_URL });

  for (const table of ['emisores', 'clientes', 'usuario_emisor', 'emisor_configuracion']) {
    const rows = await pool.query(`SELECT * FROM ${table}`);
    console.log(`\n=== ${table} (${rows.rowCount}) ===`);
    console.log(JSON.stringify(rows.rows, null, 2));
  }

  await pool.end();
}

main().catch(console.error);
