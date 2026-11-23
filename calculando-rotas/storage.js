// Adaptador local para a API DataSystem usada no SITE123.
// Os dados são armazenados no localStorage deste navegador.
(function () {
  function get(ns) { try { return JSON.parse(localStorage.getItem(ns) || '{}'); } catch (_) { return {}; } }
  function save(ns, rows) { localStorage.setItem(ns, JSON.stringify(rows)); }
  window.DataSystem = {
    list: function (ns, opts) {
      var rows = Object.entries(get(ns)).map(function (pair) { return {key_txt:pair[0],data_json:JSON.stringify(pair[1])}; });
      var page = Math.max(1, Number(opts && opts.page) || 1), limit = Math.max(1,Number(opts && opts.limit)||50);
      return Promise.resolve({success:true, keys:rows.slice((page-1)*limit,page*limit),pagination:{pagesLeft:Math.max(0,Math.ceil(rows.length/limit)-page)}});
    },
    set: function (ns,key,value) { try {var rows=get(ns);rows[key]=value;save(ns,rows);return Promise.resolve({success:true});} catch(e){return Promise.reject(e);} },
    delete: function (ns,key) { try {var rows=get(ns);delete rows[key];save(ns,rows);return Promise.resolve({success:true});} catch(e){return Promise.reject(e);} }
  };
})();
