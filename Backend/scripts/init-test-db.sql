-- Runs automatically the first time the postgres container initializes its
-- data volume (see docker-compose.yml). Creates a second database so
-- integration tests never touch the dev database.
CREATE DATABASE borrowcircle_test;
