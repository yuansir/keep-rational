import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const rawContent = readFileSync(
  join(__dirname, '../raw-catalogue.js'),
  'utf-8'
);

const jsCode = rawContent + '\nlist;';
const vm = await import('vm');
const context = {};
vm.createContext(context);
const tracks = vm.runInContext(jsCode, context);

const albumMap = new Map();

tracks.forEach((track, index) => {
  const albumName = track.artist.replace('专辑-', '');
  
  if (!albumMap.has(albumName)) {
    albumMap.set(albumName, {
      name: albumName,
      cover: track.cover,
      tracks: []
    });
  }
  
  albumMap.get(albumName).tracks.push({
    id: `track-${index}`,
    name: track.name,
    url: track.url,
    albumName: albumName
  });
});

const albums = Array.from(albumMap.values());

const catalogue = {
  albums,
  totalTracks: tracks.length,
  generatedAt: new Date().toISOString()
};

writeFileSync(
  join(__dirname, '../src/data/catalogue.json'),
  JSON.stringify(catalogue, null, 2)
);

console.log(`Processed ${tracks.length} tracks across ${albums.length} albums`);
