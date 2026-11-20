const request = require('supertest');
const { createApp } = require('../server');

function createFakePool() {
  let nextId = 1;
  const libros = [];

  return {
    async query(sql, params = []) {
      const normalized = sql.trim().toUpperCase();

      if (normalized === 'SELECT 1') {
        return [[{ 1: 1 }], []];
      }

      if (normalized.startsWith('INSERT INTO LIBROS')) {
        const [titulo, autor, anio_publicacion] = params;
        const nuevo = {
          id: nextId++,
          titulo,
          autor,
          anio_publicacion,
          creado_en: '2026-11-19 20:00:00'
        };
        libros.push(nuevo);
        return [{ insertId: nuevo.id, affectedRows: 1 }, []];
      }

      if (normalized.startsWith('SELECT * FROM LIBROS WHERE ID = ?')) {
        const [id] = params;
        const found = libros.filter((item) => item.id === Number(id));
        return [found, []];
      }

      if (normalized.startsWith('SELECT * FROM LIBROS ORDER BY ID DESC')) {
        return [[...libros].reverse(), []];
      }

      if (normalized.startsWith('UPDATE LIBROS SET')) {
        const [titulo, autor, anio_publicacion, id] = params;
        const idx = libros.findIndex((item) => item.id === Number(id));
        if (idx === -1) return [{ affectedRows: 0 }, []];
        libros[idx] = { ...libros[idx], titulo, autor, anio_publicacion };
        return [{ affectedRows: 1 }, []];
      }

      if (normalized.startsWith('DELETE FROM LIBROS WHERE ID = ?')) {
        const [id] = params;
        const idx = libros.findIndex((item) => item.id === Number(id));
        if (idx === -1) return [{ affectedRows: 0 }, []];
        libros.splice(idx, 1);
        return [{ affectedRows: 1 }, []];
      }

      throw new Error(`Consulta no soportada en fakePool: ${sql}`);
    }
  };
}

describe('API de Libros - Pruebas automatizadas sin RDS real', () => {
  let app;

  beforeEach(() => {
    app = createApp(createFakePool());
  });

  test('GET /health responde 200 y estado ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.service).toBe('api-libros');
  });

  test('POST /libros crea un libro válido y devuelve 201', async () => {
    const res = await request(app)
      .post('/libros')
      .send({
        titulo: 'Cien años de soledad',
        autor: 'Gabriel García Márquez',
        anio_publicacion: 1967
      });

    expect(res.status).toBe(201);
    expect(res.body.id).toBe(1);
    expect(res.body.titulo).toBe('Cien años de soledad');
    expect(res.body.autor).toBe('Gabriel García Márquez');
    expect(res.body.anio_publicacion).toBe(1967);
  });

  test('POST /libros rechaza datos inválidos y devuelve 400', async () => {
    const res = await request(app)
      .post('/libros')
      .send({
        titulo: '',
        autor: 'Autor sin título',
        anio_publicacion: 'no-es-numero'
      });

    expect(res.status).toBe(400);
    expect(Array.isArray(res.body.errors)).toBe(true);
    expect(res.body.errors.length).toBeGreaterThan(0);
  });

  test('GET /libros/:id devuelve 404 cuando el libro no existe', async () => {
    const res = await request(app).get('/libros/999');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Libro no encontrado');
  });
});