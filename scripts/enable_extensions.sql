-- Enable Extensions one by one to catch errors
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "pgjwt" WITH SCHEMA extensions;

-- pg_graphql must be in graphql schema
CREATE SCHEMA IF NOT EXISTS graphql;
CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA graphql;
