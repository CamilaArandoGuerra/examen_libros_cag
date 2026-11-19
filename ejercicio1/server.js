require('dotenv').config();
const express = require('express');
const mysql = require('mysql2/promise');

const app = express();
app.use(express.json());

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10
});

function parseAnio(value) {
  if (value === null || value === undefined || value === '' || typeof value === 'boolean') return null;
  const num = typeof value === 'number' ? value : Number(String(value).trim());
  if (!Number.isInteger(num)) return null;
  return num;
}

function validateLibroBody(body, { partial = false } = {}) {
  const errors = [];
  const data = {};

  if (!partial || body.titulo !== undefined) {
    const titulo = typeof body.titulo === 'string' ? body.titulo.trim() : '';
    if (!titulo) errors.push('titulo es obligatorio y no puede estar vacio');
    else data.titulo = titulo;
  }

  if (!partial || body.autor !== undefined) {
    const autor = typeof body.autor === 'string' ? body.autor.trim() : '';
    if (!autor) errors.push('autor es obligatorio y no puede estar vacio');
    else data.autor = autor;
  }

  if (!partial || body.anio_publicacion !== undefined) {
    const anio = parseAnio(body.anio_publicacion);
    if (anio === null) errors.push('anio_publicacion debe ser un numero entero valido');
    else data.anio_publicacion = anio;
  }

  return { errors, data };
}

async function healthHandler(req, res) {
  try {
    await pool.query('SELECT 1');
    res.status(200).json({ status: 'ok', service: 'api-libros', db: 'connected' });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
}

app.get('/health', healthHandler);
app.get('/', healthHandler);

app.get('/libros', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM libros ORDER BY id DESC');
    res.status(200).json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/libros/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'id invalido' });
    const [rows] = await pool.query('SELECT * FROM libros WHERE id = ?', [id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Libro no encontrado' });
    res.status(200).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/libros', async (req, res) => {
  try {
    const { errors, data } = validateLibroBody(req.body, { partial: false });
    if (errors.length > 0) return res.status(400).json({ errors });

    const [result] = await pool.query(
      'INSERT INTO libros (titulo, autor, anio_publicacion) VALUES (?, ?, ?)',
      [data.titulo, data.autor, data.anio_publicacion]
    );
    const [rows] = await pool.query('SELECT * FROM libros WHERE id = ?', [result.insertId]);
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/libros/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'id invalido' });

    const { errors, data } = validateLibroBody(req.body, { partial: true });
    if (errors.length > 0) return res.status(400).json({ errors });

    const [existing] = await pool.query('SELECT * FROM libros WHERE id = ?', [id]);
    if (existing.length === 0) return res.status(404).json({ error: 'Libro no encontrado' });

    const actual = existing[0];
    const nextTitulo = data.titulo ?? actual.titulo;
    const nextAutor = data.autor ?? actual.autor;
    const nextAnio = data.anio_publicacion ?? actual.anio_publicacion;

    await pool.query(
      'UPDATE libros SET titulo = ?, autor = ?, anio_publicacion = ? WHERE id = ?',
      [nextTitulo, nextAutor, nextAnio, id]
    );
    const [rows] = await pool.query('SELECT * FROM libros WHERE id = ?', [id]);
    res.status(200).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/libros/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'id invalido' });

    const [result] = await pool.query('DELETE FROM libros WHERE id = ?', [id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Libro no encontrado' });
    res.status(200).json({ message: 'Libro eliminado correctamente' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = Number(process.env.PORT || 3000);
app.listen(PORT, '127.0.0.1', () => {
  console.log(`Servidor escuchando en http://127.0.0.1:${PORT}`);
});