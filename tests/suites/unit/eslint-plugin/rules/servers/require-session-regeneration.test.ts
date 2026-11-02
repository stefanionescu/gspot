import plugin from '#eslint-plugin/plugin.ts';
import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';

buildRuleTester().run('require-session-regeneration', plugin.rules['require-session-regeneration'], {
    valid: [
        "import passport from 'passport';\napp.post('/login', passport.authenticate('local'), function (req, res) {\n  req.session.regenerate(() => res.redirect('/'));\n});",
        "import passport from 'passport';\nfunction addLogin(handler) {\n  app.post('/login', passport.authenticate('local'), handler);\n}",
    ],
    invalid: [
        {
            code: "const passport = require('passport');\napp.post('/login', passport.authenticate('local', { failureRedirect: '/login' }), function (req, res) {\n  res.redirect('/');\n});\napp.post('/login2', passport.authenticate('local'), function (req, res) {\n  req.session.regenerate(() => res.redirect('/'));\n});\napp.post('/api', passport.authenticate('bearer', { session: false }), function (req, res) {\n  res.json({});\n});",
            errors: [{ messageId: 'keptSession', line: 2 }],
        },
    ],
});
