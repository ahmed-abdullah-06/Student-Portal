const { getSettings, setSettings, DEFAULTS } = require('../services/settings');

exports.listSettings = async (req, res, next) => {
  try {
    res.json({ settings: await getSettings(), schema: Object.keys(DEFAULTS) });
  } catch (err) { next(err); }
};

/** Public branding (no auth) — used by the login page for branding before auth. */
exports.publicBranding = async (req, res, next) => {
  try {
    const b = await getSettings();
    res.json({ branding: b.branding, features: b.features });
  } catch (err) { next(err); }
};

exports.updateSettings = async (req, res, next) => {
  try {
    const section = req.params.section;
    if (!(section in DEFAULTS)) return res.status(404).json({ message: 'Unknown settings section' });
    const merged = await setSettings(section, req.validated || req.body, req.user.id);
    res.json({ settings: merged, message: 'Settings updated' });
  } catch (err) { next(err); }
};
