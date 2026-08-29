(function (global) {
  const LOCAL_DEMO_HOSTS = new Set(['localhost', '127.0.0.1']);
  const EVENT_ROUTES = new Map([
    ['', 'event'],
    ['edit', 'event-edit'],
    ['reports', 'reports'],
    ['orders', 'orders']
  ]);
  const STATIC_ROUTES = new Map([
    ['/', 'events'],
    ['/accounts', 'accounts'],
    ['/settings', 'settings'],
    ['/audit', 'audit']
  ]);

  function isLocalDemoHost(hostname) {
    return LOCAL_DEMO_HOSTS.has(String(hostname || '').toLowerCase());
  }

  function isEventOpen(event) {
    return event?.manual_status === 'open';
  }

  function passwordsMatch(password, confirmation) {
    return String(password ?? '') === String(confirmation ?? '');
  }

  function routeFromPath(pathname, events) {
    const normalized = pathname || '/';
    const staticScreen = STATIC_ROUTES.get(normalized);
    if (staticScreen) return { screen: staticScreen, event: null, invalid: false };

    const match = normalized.match(/^\/events\/([^/]+)(?:\/([^/]+))?\/?$/);
    if (match && EVENT_ROUTES.has(match[2] || '')) {
      let slug;
      try { slug = decodeURIComponent(match[1]); } catch { slug = match[1]; }
      const event = (events || []).find(item => item.slug === slug) || null;
      if (event) return { screen: EVENT_ROUTES.get(match[2] || ''), event, invalid: false };
    }

    return { screen: 'events', event: null, invalid: normalized !== '/' };
  }

  function pathForScreen(screen, event) {
    if (screen === 'accounts') return '/accounts';
    if (screen === 'settings') return '/settings';
    if (screen === 'audit') return '/audit';
    if (!event) return '/';
    const base = `/events/${encodeURIComponent(event.slug)}`;
    if (screen === 'event-edit') return `${base}/edit`;
    if (screen === 'reports') return `${base}/reports`;
    if (screen === 'orders') return `${base}/orders`;
    return screen === 'event' ? base : '/';
  }

  global.APP_RUNTIME = Object.freeze({ isLocalDemoHost, isEventOpen, passwordsMatch, routeFromPath, pathForScreen });
})(globalThis);
