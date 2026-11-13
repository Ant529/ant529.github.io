/**
 * Ant 站点 · 游戏库加载
 * ------------------------------------------------------------
 * 作用：
 *   从 games/index.json 读取游戏清单，渲染成卡片。
 *   没有上传功能——游戏由助手手动放入 games/ 目录并登记。
 *
 * 兼容两种情况：
 *   1. 通过服务访问（http://...）→ 用 fetch 拉 index.json
 *   2. 直接双击打开（file://）  → fetch 会被浏览器拦截，
 *      此时尝试读取内嵌在页面里的兜底数据
 */

(function () {
  'use strict';

  var grid = document.getElementById('gameGrid');
  var emptyState = document.getElementById('emptyState');
  var countEl = document.getElementById('gamesCount');

  if (!grid) return;

  /* ---------------- 渲染 ---------------- */

  function render(games) {
    grid.innerHTML = '';

    if (!games || !games.length) {
      if (emptyState) emptyState.hidden = false;
      if (countEl) countEl.textContent = '';
      return;
    }

    if (emptyState) emptyState.hidden = true;
    if (countEl) countEl.textContent = '共 ' + games.length + ' 个';

    games.forEach(function (g) {
      var card = document.createElement('article');
      card.className = 'game-card';

      // 封面区
      var cover = document.createElement('div');
      cover.className = 'game-card__cover';

      // 封面图（按用户要求已移除：不再放游戏截图，只留 GOBAgame 品牌）
      // 若清单里仍带 cover 字段则照常渲染，方便以后想加回来
      if (g.cover) {
        var img = document.createElement('img');
        img.className = 'game-card__cover-img';
        img.src = encodePath(g.cover);
        img.alt = g.title || '';
        img.loading = 'lazy';
        cover.appendChild(img);
      } else {
        cover.className += ' game-card__cover--brand';
        var mark = document.createElement('img');
        mark.className = 'game-card__mark';
        mark.src = 'assets/img/gobagame-white.png';
        mark.alt = 'GOBAgame';
        cover.appendChild(mark);
      }

      // 引擎标签（左上）
      var badge = document.createElement('span');
      badge.className = 'game-card__badge';
      badge.textContent = g.engine || 'GAME';
      cover.appendChild(badge);

      // 发行商徽标 GOBAgame（右下）—— 只在有封面图时叠加，避免和中央 logo 重复
      if (g.cover) {
        var brand = document.createElement('span');
        brand.className = 'game-card__brand';
        var brandImg = document.createElement('img');
        brandImg.src = 'assets/img/gobagame-white.png';
        brandImg.alt = 'GOBAgame';
        brand.appendChild(brandImg);
        cover.appendChild(brand);
      }

      // 信息区
      var body = document.createElement('div');
      body.className = 'game-card__body';

      var title = document.createElement('h3');
      title.className = 'game-card__title';
      title.textContent = g.title || g.file;

      var meta = document.createElement('p');
      meta.className = 'game-card__meta';
      var parts = [];
      if (g.size) parts.push(formatSize(g.size));
      if (g.addedAt) parts.push(formatDate(g.addedAt));
      meta.textContent = parts.join(' · ');

      // 操作区
      var actions = document.createElement('div');
      actions.className = 'game-card__actions';

      var play = document.createElement('a');
      play.className = 'btn';
      // 按路径段编码：encodeURIComponent 会把 "/" 也编成 %2F，导致 404
      play.href = 'games/' + encodePath(g.file);
      play.target = '_blank';
      play.rel = 'noopener';
      play.textContent = '开始游戏';

      actions.appendChild(play);

      // 安卓版下载（可选）
      if (g.apk) {
        var dl = document.createElement('a');
        dl.className = 'btn btn--ghost';
        dl.href = 'games/' + encodePath(g.apk);
        dl.setAttribute('download', '');
        dl.textContent = '📱 安卓版';
        if (g.apkSize) dl.title = '安装包 ' + formatSize(g.apkSize);
        actions.appendChild(dl);
      }

      body.appendChild(title);
      if (meta.textContent) body.appendChild(meta);
      body.appendChild(actions);

      card.appendChild(cover);
      card.appendChild(body);

      grid.appendChild(card);
    });
  }

  /* ---------------- 工具 ---------------- */

  /**
   * 按路径段编码，保留 "/" 分隔符。
   * 直接用 encodeURIComponent 会把 "giant-ant/index.html" 编成
   * "giant-ant%2Findex.html"，服务器当作一个文件名 → 404 → 白/黑屏。
   */
  function encodePath(p) {
    if (!p) return '';
    // 保留 ?query —— 封面用 "xx.png?v=<hash>" 做缓存刷新，
    // 若整串 encodeURIComponent 会变成 "xx.png%3Fv%3D..." → 404。
    var parts = String(p).split('?');
    var path = parts[0].split('/').map(function (seg) {
      return encodeURIComponent(seg);
    }).join('/');
    return parts.length > 1 ? path + '?' + parts.slice(1).join('?') : path;
  }

  function formatSize(bytes) {
    if (!bytes && bytes !== 0) return '';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1024 / 1024).toFixed(1) + ' MB';
  }

  function formatDate(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return d.getFullYear() + '-' +
      String(d.getMonth() + 1).padStart(2, '0') + '-' +
      String(d.getDate()).padStart(2, '0');
  }

  /* ---------------- 加载 ---------------- */

  function load() {
    // file:// 下 fetch 本地文件会被 CORS 拦截，直接用内嵌数据
    if (location.protocol === 'file:') {
      render(window.ANT_GAMES || []);
      return;
    }

    fetch('games/index.json', { cache: 'no-store' })
      .then(function (r) {
        if (!r.ok) throw new Error('no list');
        return r.json();
      })
      .then(function (data) {
        render(Array.isArray(data) ? data : (data.games || []));
      })
      .catch(function () {
        // 没有清单文件时用内嵌数据兜底
        render(window.ANT_GAMES || []);
      });
  }

  load();
})();
