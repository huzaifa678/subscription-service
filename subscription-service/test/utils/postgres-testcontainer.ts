import { GenericContainer, StartedTestContainer } from 'testcontainers';

export async function startPostgresContainer(): Promise<{
  container: StartedTestContainer;
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
}> {
  const container = await new GenericContainer('postgres:16-alpine')
    .withEnvironment({
      POSTGRES_DB: 'test_db',
      POSTGRES_USER: 'test',
      POSTGRES_PASSWORD: 'test',
    })
    .withExposedPorts(5432)
    .start();

  return {
    container,
    host: container.getHost(),
    port: container.getMappedPort(5432),
    database: 'test_db',
    username: 'test',
    password: 'test',
  };
}
