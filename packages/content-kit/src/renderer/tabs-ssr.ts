import * as cheerio from 'cheerio/slim';

/**
 * Build <div role="tablist" ...> and hide inactive panels for
 * <div data-type="tabs"> blocks emitted by renderToHTMLString.
 * - Reads data-active-index from the tabs root (default 0).
 * - Uses each panel’s data-title and data-tid to wire ARIA.
 * - Wraps panels in .dfy-tabs-content if missing.
 */
export async function processTabsSSR(html: string) {
  const $ = cheerio.load(html, undefined, false);

  $('div[data-type="tabs"]').each((_i, el) => {
    const $root = $(el);
    const activeRaw = $root.attr('data-active-index') || '0';
    const active = Math.max(0, parseInt(activeRaw, 10) || 0);

    // --- Refactored Content Wrapper Logic ---
    if ($root.children('.dfy-tabs-content').length === 0) {
      // If it doesn't exist, create it and move the panels inside.
      const $newContent = $('<div class="dfy-tabs-content" />');
      const panels = $root.children('div[data-type="tab"]');
      $newContent.append(panels);
      $root.append($newContent);
    }
    // Now, unconditionally select the content wrapper. Its type is now stable.
    const $content = $root.children('.dfy-tabs-content');

    // --- Refactored Tablist Logic ---
    if ($root.children('[role="tablist"]').length === 0) {
      // If it doesn't exist, create it.
      $root.prepend('<div role="tablist" class="dfy-tabs-header" />');
    }
    // Unconditionally select the tablist and empty it. Its type is now stable.
    const $tablist = $root.children('[role="tablist"]');
    $tablist.empty();


    // --- The rest of the logic remains the same ---
    const panels = $content.children('div[data-type="tab"]');
    const max = Math.max(0, panels.length - 1);
    const selectedIndex = Math.min(active, max);

    panels.each((idx, pnl) => {
      const $p = $(pnl);
      const title = ($p.attr('data-title') || `Tab ${idx + 1}`).trim();
      let tid = $p.attr('data-tid');
      if (!tid) {
        tid = `tt-tab-${Date.now()}-${idx}`;
        $p.attr('data-tid', tid);
      }
      const selected = idx === selectedIndex;

      $p.attr('role', 'tabpanel');
      $p.attr('id', `panel-${tid}`);
      $p.attr('aria-labelledby', `tab-${tid}`);
      if (selected) $p.removeAttr('hidden');
      else $p.attr('hidden', 'hidden');

      const $btn = $('<button type="button" class="dfy-tab" role="tab" />')
        .attr('id', `tab-${tid}`)
        .attr('aria-controls', `panel-${tid}`)
        .attr('aria-selected', String(selected))
        .attr('tabindex', selected ? '0' : '-1')
        .text(title);

      $tablist.append($btn);
    });
  });

  return $.html();
}