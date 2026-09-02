-- ============================================
-- CONFIGURACIÓN DE RAG (Retrieval Augmented Generation)
-- Base de Conocimiento con pg_vector en Supabase
-- ============================================

-- PASO 1: Habilitar la extensión pg_vector (si no está habilitada)
-- Ejecutar en el SQL Editor de Supabase
CREATE EXTENSION IF NOT EXISTS vector;

-- PASO 2: Crear la tabla knowledge_base
CREATE TABLE IF NOT EXISTS knowledge_base (
  id SERIAL PRIMARY KEY,
  content TEXT NOT NULL,
  embedding vector(1536), -- Dimensión para text-embedding-3-small (1536) o text-embedding-ada-002 (1536)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- PASO 3: Crear índice para búsqueda vectorial eficiente
-- Usa HNSW (Hierarchical Navigable Small World) para búsquedas rápidas
CREATE INDEX IF NOT EXISTS knowledge_base_embedding_idx 
ON knowledge_base 
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- Nota: Si tu versión de pg_vector soporta HNSW, puedes usar:
-- CREATE INDEX IF NOT EXISTS knowledge_base_embedding_idx 
-- ON knowledge_base 
-- USING hnsw (embedding vector_cosine_ops);

-- PASO 4: Crear función RPC para búsqueda de similitud
-- Esta función será llamada desde el código TypeScript
CREATE OR REPLACE FUNCTION match_knowledge_base(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 5
)
RETURNS TABLE (
  id int,
  content text,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    knowledge_base.id,
    knowledge_base.content,
    1 - (knowledge_base.embedding <=> query_embedding) AS similarity
  FROM knowledge_base
  WHERE 1 - (knowledge_base.embedding <=> query_embedding) > match_threshold
  ORDER BY knowledge_base.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- PASO 5: Configurar Row Level Security (RLS)
-- Deshabilitar RLS para permitir acceso desde el service role
ALTER TABLE knowledge_base DISABLE ROW LEVEL SECURITY;

-- O si prefieres mantener RLS habilitado, crear una política que permita todo al service role:
-- ALTER TABLE knowledge_base ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Allow service role full access" ON knowledge_base
--   FOR ALL
--   USING (true)
--   WITH CHECK (true);

-- PASO 6: Crear trigger para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_knowledge_base_updated_at
  BEFORE UPDATE ON knowledge_base
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- EJEMPLOS DE INSERCIÓN DE DATOS
-- ============================================

-- NOTA: Para insertar datos, necesitarás generar los embeddings primero
-- usando la API de OpenAI y luego insertarlos en la tabla.

-- Ejemplo de estructura para insertar (desde tu aplicación):
-- INSERT INTO knowledge_base (content, embedding)
-- VALUES (
--   'ARTEMA es una tienda especializada en timbres personalizados ubicada en el centro de Santiago, Providencia.',
--   '[array de 1536 números generado por OpenAI]'
-- );

-- ============================================
-- FUNCIÓN AUXILIAR PARA GENERAR EMBEDDINGS
-- ============================================

-- Si quieres generar embeddings directamente desde Supabase (requiere Edge Function):
-- Puedes crear una Edge Function que llame a la API de OpenAI y luego inserte en la tabla.

-- ============================================
-- CONSULTAS ÚTILES
-- ============================================

-- Ver todos los registros
-- SELECT id, content, created_at FROM knowledge_base;

-- Contar registros
-- SELECT COUNT(*) FROM knowledge_base;

-- Buscar manualmente (ejemplo)
-- SELECT content, 
--        1 - (embedding <=> '[tu_vector_aquí]'::vector) AS similarity
-- FROM knowledge_base
-- ORDER BY embedding <=> '[tu_vector_aquí]'::vector
-- LIMIT 5;

-- ============================================
-- NOTAS IMPORTANTES
-- ============================================

-- 1. La dimensión del vector debe coincidir con el modelo de embeddings que uses:
--    - text-embedding-3-small: 1536 dimensiones
--    - text-embedding-ada-002: 1536 dimensiones
--    - text-embedding-3-large: 3072 dimensiones (ajustar el vector(1536) si usas este)

-- 2. El operador <=> calcula la distancia de coseno (1 - similitud de coseno)

-- 3. El índice ivfflat es más rápido pero menos preciso que HNSW (si está disponible)

-- 4. Ajusta el parámetro 'lists' en el índice según el tamaño de tu base de datos:
--    - Pequeña (< 10K registros): lists = 10-50
--    - Mediana (10K-100K): lists = 50-100
--    - Grande (> 100K): lists = 100-200

-- 5. Para producción, considera agregar campos adicionales como:
--    - source: TEXT (URL o referencia del documento original)
--    - metadata: JSONB (información adicional)
--    - category: TEXT (categoría del conocimiento)

