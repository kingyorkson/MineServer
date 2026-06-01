export interface VersionManifest {
  latest: { release: string; snapshot: string };
  versions: VersionInfo[];
}

export interface VersionInfo {
  id: string;
  type: string;
  url: string;
  time: string;
  releaseTime: string;
}

export interface LoaderInfo {
  name: string;
  id: string;
  label: string;
}

export const JAVA_LOADERS: LoaderInfo[] = [
  { name: 'Vanilla', id: 'vanilla', label: 'Vanilla' },
  { name: 'Forge', id: 'forge', label: 'Forge' },
  { name: 'Quilt', id: 'quilt', label: 'Quilt' },
  { name: 'Fabric', id: 'fabric', label: 'Fabric' },
  { name: 'NeoForge', id: 'neoforge', label: 'NeoForge' },
];

export const BEDROCK_VERSIONS: string[] = [
  '1.21.50', '1.21.44', '1.21.31', '1.21.22', '1.21.2',
  '1.20.81', '1.20.73', '1.20.72', '1.20.71', '1.20.62',
  '1.20.51', '1.20.41', '1.20.32', '1.20.15', '1.20.1',
  '1.19.83', '1.19.73', '1.19.63', '1.19.51', '1.19.41',
  '1.19.31', '1.19.22', '1.19.11', '1.19.1', '1.18.33',
  '1.18.32', '1.18.12', '1.18.2', '1.17.41', '1.17.34',
  '1.17.33', '1.17.11', '1.17.2', '1.16.221', '1.16.220',
  '1.16.201', '1.16.101', '1.16.21', '1.16.20', '1.16.1',
];

export async function fetchVanillaVersions(): Promise<VersionInfo[]> {
  const res = await fetch('https://piston-meta.mojang.com/mc/game/version_manifest_v2.json');
  const data: VersionManifest = await res.json();
  return data.versions.filter(v => v.type === 'release');
}

export async function fetchFabricVersions(): Promise<string[]> {
  const res = await fetch('https://meta.fabricmc.net/v2/versions/game');
  const data = await res.json();
  return data.map((v: any) => v.version).filter((v: string) => !v.includes('inf'));
}

export async function fetchForgeVersions(): Promise<string[]> {
  const res = await fetch('https://files.minecraftforge.net/net/minecraftforge/forge/maven-metadata.json');
  const data = await res.json();
  return Object.keys(data).filter(k => !k.includes('_'));
}

export async function fetchQuiltVersions(): Promise<string[]> {
  const res = await fetch('https://meta.quiltmc.org/v3/versions/game');
  const data = await res.json();
  return data.map((v: any) => v.version);
}

export async function fetchNeoForgeVersions(): Promise<string[]> {
  const res = await fetch('https://maven.neoforged.net/releases/net/neoforged/neoforge/maven-metadata.xml');
  const text = await res.text();
  const versions: string[] = [];
  const regex = /<version>([^<]+)<\/version>/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    const v = match[1];
    const mcVersion = v.split('-')[0];
    if (!versions.includes(mcVersion)) versions.push(mcVersion);
  }
  return versions.filter(v => !!v);
}

export async function getVersionsForLoader(loaderId: string): Promise<string[]> {
  switch (loaderId) {
    case 'vanilla': return (await fetchVanillaVersions()).map(v => v.id);
    case 'fabric': return fetchFabricVersions();
    case 'forge': return fetchForgeVersions();
    case 'quilt': return fetchQuiltVersions();
    case 'neoforge': return fetchNeoForgeVersions();
    default: return [];
  }
}

export function getModrinthUrl(projectId: string, version: string, loader: string): string {
  return `https://api.modrinth.com/v2/project/${projectId}/version?loaders=["${loader}"]&game_versions=["${version}"]`;
}

export async function searchModrinth(query: string, version: string, loader: string) {
  const facets = `[["project_type:mod"],["versions:${version}"],["categories:${loader}"]]`;
  const res = await fetch(`https://api.modrinth.com/v2/search?query=${encodeURIComponent(query)}&facets=${encodeURIComponent(facets)}&limit=20`);
  const data = await res.json();
  return data.hits || [];
}

export async function searchCurseForge(query: string, version: string, loader: string) {
  const gameId = 432;
  const classId = 6;
  const loaderMap: Record<string, number> = { fabric: 4, forge: 1, quilt: 5, neoforge: 3 };
  const modLoaderType = loaderMap[loader] || 1;
  const url = `https://api.curseforge.com/v1/mods/search?gameId=${gameId}&classId=${classId}&searchFilter=${encodeURIComponent(query)}&gameVersion=${encodeURIComponent(version)}&modLoaderType=${modLoaderType}`;
  const res = await fetch(url, {
    headers: { 'x-api-key': '$2a$10$F5nLqFPGRQ8Y1WqJZqPqZOz9hJVYq1KqZqPqZOz9hJVYq1KqZqP' }
  });
  if (!res.ok) return [];
  const data = await res.json();
  return data.data || [];
}
