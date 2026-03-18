const express = require('express');
const path = require('path');
const app = express();
const port = process.env.PORT || 3000;

// Configuración de usuario
const USERNAME = 'nienna';
const PASSWORD = 'banana2026';

// --- BASES DE DATOS ---

// 1. Canales de TV en Vivo
const live_streams = [
  {
    num: 1,
    name: "Canal de Prueba HD",
    stream_type: "live",
    stream_id: 5001,
    stream_icon: "https://via.placeholder.com/300x300.png?text=TV",
    category_id: "100",
    added: "1773819317",
    direct_source: "https://demo.unified-streaming.com/k8s/features/stable/video/tears-of-steel/tears-of-steel.ism/.m3u8"
  }
];

const liveCategories = [
  { category_id: "100", category_name: "📺 TV EN VIVO", parent_id: 0 }
];

// 2. Películas
const movies = [
  {
    stream_id: 1773819317429,
    num: 0,
    name: "Atraccion Peculiar (1988)",
    title: "Atraccion Peculiar (1988)",
    stream_type: "movie",
    stream_icon: "https://dn710105.ca.archive.org/0/items/atraccion-peculiar-1988/__ia_thumb.jpg",
    rating: "5.0",
    rating_5based: 2.50,
    added: "1773819317",
    category_id: "1",
    container_extension: "mp4",
    direct_source: "https://archive.org/download/atraccion-peculiar-1988/Atraccion%20peculiar%20%281988%29.mp4"
  }
];

const categories = [
  { category_id: "1", category_name: "🎬 Películas", parent_id: 0 }
];

// 3. Series
const series = [
  {
    series_id: 1,
    name: "Pluribus",
    cover: "https://i.imgur.com/tVdzIkh.jpeg",
    plot: "Serie ambientada en Albuquerque...",
    genre: "Drama, Ciencia ficción",
    rating: "9.0",
    category_id: "1"
  }
];

const seriesCategories = [
  { category_id: "1", category_name: "📺 Series", parent_id: 0 }
];

const seriesEpisodes = {
  1: {
    seasons: [{ season_number: 1, name: "Temporada 1", episode_count: 1 }],
    episodes: {
      1: [{
        id: "101",
        episode_num: 1,
        title: "Episodio 1",
        container_extension: "mp4",
        info: { name: "Episodio 1", season: 1, episode_num: 1, plot: "Piloto" },
        direct_source: "https://tu-url-video.mp4"
      }]
    }
  }
};

// --- MIDDLEWARE Y RUTAS ---

app.use(express.json());

function authenticate(req, res, next) {
  const { username, password } = req.query;
  if (username === USERNAME && password === PASSWORD) {
    next();
  } else {
    res.status(401).json({ error: "Invalid credentials" });
  }
}

// Endpoint M3U para TiviMate/VLC
app.get('/get.php', (req, res) => {
  const { username, password, type } = req.query;
  if (username !== USERNAME || password !== PASSWORD) return res.status(401).send('Error');

  const baseUrl = `${req.protocol}://${req.get('host')}`;
  let m3u = '#EXTM3U\n\n';

  // Canales TV
  if (!type || type === 'live') {
    live_streams.forEach(l => {
      m3u += `#EXTINF:-1 tvg-id="${l.stream_id}" tvg-logo="${l.stream_icon}" group-title="TV EN VIVO",${l.name}\n${l.direct_source}\n\n`;
    });
  }

  // Películas
  if (!type || type === 'movie') {
    movies.forEach(m => {
      m3u += `#EXTINF:-1 tvg-id="${m.stream_id}" tvg-logo="${m.stream_icon}" group-title="Películas",${m.name}\n${baseUrl}/movie/${username}/${password}/${m.stream_id}.${m.container_extension}\n\n`;
    });
  }

  // Series
  if (!type || type === 'series') {
    Object.keys(seriesEpisodes).forEach(sId => {
      const s = series.find(x => x.series_id == sId);
      const data = seriesEpisodes[sId];
      Object.keys(data.episodes).forEach(season => {
        data.episodes[season].forEach(ep => {
          m3u += `#EXTINF:-1 tvg-logo="${s.cover}" group-title="${s.name}",${s.name} S${season}E${ep.episode_num}\n${baseUrl}/series/${username}/${password}/${ep.id}.${ep.container_extension}\n\n`;
        });
      });
    });
  }

  res.setHeader('Content-Type', 'audio/x-mpegurl');
  res.send(m3u);
});

// Endpoint Xtream Codes API
app.get('/player_api.php', authenticate, (req, res) => {
  const action = req.query.action;
  if (action === 'get_live_streams') return res.json(live_streams);
  if (action === 'get_live_categories') return res.json(liveCategories);
  if (action === 'get_vod_streams') return res.json(movies);
  if (action === 'get_vod_categories') return res.json(categories);
  if (action === 'get_series') return res.json(series);
  if (action === 'get_series_categories') return res.json(seriesCategories);
  
  if (action === 'get_series_info') {
    const sId = req.query.series_id;
    return res.json({ info: series.find(s => s.series_id == sId), seasons: seriesEpisodes[sId].seasons, episodes: seriesEpisodes[sId].episodes });
  }

  res.json({
    user_info: { auth: 1, status: "Active", exp_date: "2099999999" },
    server_info: { url: req.get('host'), port: port, https_port: "443", server_protocol: "https" }
  });
});

// Streaming Redirectors
app.get('/movie/:username/:password/:id.:ext', (req, res) => {
  const m = movies.find(x => x.stream_id == req.params.id);
  m ? res.redirect(m.direct_source) : res.status(404).send('Not found');
});

app.get('/series/:username/:password/:id.:ext', (req, res) => {
  let found = null;
  for (const s in seriesEpisodes) {
    for (const season in seriesEpisodes[s].episodes) {
      const ep = seriesEpisodes[s].episodes[season].find(e => e.id === req.params.id);
      if (ep) { found = ep; break; }
    }
  }
  found ? res.redirect(found.direct_source) : res.status(404).send('Not found');
});

app.get('/portal', (req, res) => res.sendFile(path.join(__dirname, 'portal.html')));
app.get('/', (req, res) => res.send('API Online'));

app.listen(port, () => console.log(`Server on port ${port}`));
