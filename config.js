/* Pujo Parikrama — site configuration (safe to edit before publishing). */
window.PP_CONFIG = {
  /* Optional: a Google Maps Platform API key with "Maps JavaScript API" and
     "Places API (New)" enabled. Restrict it to your site's URL (HTTP referrer)
     in Google Cloud Console. Leave empty to use the keyless Google map cards only;
     visitors can still connect their own key from the "Google ratings" button. */
  googleMapsApiKey: "",

  /* Radius in metres for live Google nearby-food searches around a pandal. */
  liveRadius: 800,

  /* Map tiles. Default: standard OpenStreetMap tiles (free for light use, attribution required —
     see https://operations.osmfoundation.org/policies/tiles/). For a busy public site, switch to a
     provider with a key (e.g. MapTiler, Stadia, Thunderforest) by changing `url` and `attribution`.
     `darkFilter` re-colours light tiles for the dark theme. */
  tiles: {
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors',
    maxZoom: 19,
    darkFilter: true
  }
};
