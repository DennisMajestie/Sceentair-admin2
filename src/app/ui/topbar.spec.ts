import { NAV } from '../core/nav';
import { activePageFor } from './topbar';

describe('topbar active page', () => {
  const production = NAV.find((section) => section.id === 'production')!;
  const messages = NAV.find((section) => section.id === 'messages')!;

  it('activates only the production tab matching the current route', () => {
    expect(activePageFor('/production', production.pages)).toBe('/production');
    expect(activePageFor('/production/batch-1', production.pages)).toBe('/production');
    expect(activePageFor('/production/wip', production.pages)).toBe('/production/wip');
    expect(activePageFor('/production/tech-packs', production.pages)).toBe('/production/tech-packs');
    expect(activePageFor('/production/tech-packs/tp-1', production.pages)).toBe('/production/tech-packs');
    expect(activePageFor('/production/kiosk', production.pages)).toBe('/production/kiosk');
  });

  it('chooses the longest matching path when a tab is a prefix of another', () => {
    expect(activePageFor('/messages', messages.pages)).toBe('/messages');
    expect(activePageFor('/messages/inbox/123', messages.pages)).toBe('/messages/inbox');
  });

  it('ignores query strings and fragments', () => {
    expect(activePageFor('/production/kiosk?day=today#top', production.pages)).toBe('/production/kiosk');
  });
});
