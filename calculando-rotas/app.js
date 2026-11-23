// Explain: App entry point, handles data, UI interactions, and state management.
document.addEventListener('DOMContentLoaded', function () {
    var DataSystem = window.DataSystem;
    var NS_CITIES = 'rotas_cidades';
    var NS_ROADS = 'rotas_estradas';

    var state = { cities: [], roads: [], lastPath: null, resultShown: false };

    var SAMPLE_CITIES = [
        { nome: 'São Paulo', estado: 'SP' },
        { nome: 'Rio de Janeiro', estado: 'RJ' },
        { nome: 'Belo Horizonte', estado: 'MG' },
        { nome: 'Curitiba', estado: 'PR' },
        { nome: 'Salvador', estado: 'BA' },
        { nome: 'Brasília', estado: 'DF' }
    ];

    var SAMPLE_ROADS = [
        { de: 'São Paulo', para: 'Rio de Janeiro', km: 429 },
        { de: 'São Paulo', para: 'Curitiba', km: 408 },
        { de: 'São Paulo', para: 'Belo Horizonte', km: 586 },
        { de: 'Rio de Janeiro', para: 'Belo Horizonte', km: 434 },
        { de: 'Belo Horizonte', para: 'Brasília', km: 741 },
        { de: 'Curitiba', para: 'Belo Horizonte', km: 1004 },
        { de: 'Salvador', para: 'Brasília', km: 1445 },
        { de: 'Rio de Janeiro', para: 'Salvador', km: 1650 }
    ];

    function el(id) { return document.getElementById(id); }

    function setText(id, value) {
        var node = el(id);
        if (node) node.textContent = value;
    }

    function makeKey(prefix) {
        return prefix + '-' + Math.random().toString(16).slice(2, 10) + Date.now().toString(16).slice(-4);
    }

    function formatKm(value) {
        return Number(value || 0).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' km';
    }

    function normalize(value) {
        return String(value || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    }

    function toast(text, kind) {
        var stack = el('toastStack');
        if (!stack) return;
        var box = document.createElement('div');
        box.className = 'toast ' + (kind === 'error' ? 'is-error' : 'is-ok');
        var icon = document.createElement('i');
        icon.className = 'fa-solid ' + (kind === 'error' ? 'fa-circle-exclamation' : 'fa-circle-check');
        icon.setAttribute('aria-hidden', 'true');
        var span = document.createElement('span');
        span.textContent = text;
        box.appendChild(icon);
        box.appendChild(span);
        stack.appendChild(box);
        window.setTimeout(function () {
            if (box.parentNode) box.parentNode.removeChild(box);
        }, 4200);
    }

    function emptyNote(text) {
        var div = document.createElement('div');
        div.className = 'empty-note';
        div.textContent = text;
        return div;
    }

    function cityByKey(key) {
        for (var i = 0; i < state.cities.length; i += 1) {
            if (state.cities[i].key === key) return state.cities[i];
        }
        return null;
    }

    function cityName(key) {
        var city = cityByKey(key);
        return city ? city.nome : 'Cidade removida';
    }

    function parseRow(row) {
        var data = {};
        try { data = JSON.parse(row.data_json || '{}'); } catch (err) { data = {}; }
        data.key = row.key_txt;
        return data;
    }

    function fetchNamespace(ns) {
        var collected = [];
        var page = 1;

        function step() {
            return DataSystem.list(ns, { page: page, limit: 50 }).then(function (res) {
                if (!res || !res.success) throw new Error('Não foi possível carregar os dados salvos.');
                (res.keys || []).forEach(function (row) { collected.push(parseRow(row)); });
                var pagination = res.pagination || {};
                if (pagination.pagesLeft > 0 && page < 20) {
                    page += 1;
                    return step();
                }
                return collected;
            });
        }

        return step();
    }

    function byName(a, b) {
        return String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR');
    }

    function isUsableRoad(road) {
        return road && road.origem && road.destino && Number(road.distancia) > 0;
    }

    function loadData() {
        if (!DataSystem || typeof DataSystem.list !== 'function') {
            toast('O armazenamento do app ainda não está pronto. Recarregue a página.', 'error');
            return Promise.resolve();
        }
        return Promise.all([fetchNamespace(NS_CITIES), fetchNamespace(NS_ROADS)]).then(function (results) {
            state.cities = results[0].sort(byName);
            state.roads = results[1].filter(isUsableRoad);
            renderAll();
        }).catch(function (err) {
            toast(err && err.message ? err.message : 'Falha ao carregar a rede.', 'error');
        });
    }

    function renderAll() {
        renderSelects();
        renderStats();
        renderMap();
        renderCities();
        renderRoads();
        refreshRouteArea();
    }

    function cityOptions() {
        return state.cities.map(function (city) {
            return { key: city.key, label: city.estado ? city.nome + ' — ' + city.estado : city.nome };
        });
    }

    function fillSelect(select, options, placeholder) {
        if (!select) return;
        var previous = select.value;
        select.innerHTML = '';
        var first = document.createElement('option');
        first.value = '';
        first.textContent = placeholder;
        select.appendChild(first);
        options.forEach(function (opt) {
            var option = document.createElement('option');
            option.value = opt.key;
            option.textContent = opt.label;
            select.appendChild(option);
        });
        var stillThere = options.some(function (opt) { return opt.key === previous; });
        select.value = stillThere ? previous : '';
    }

    function renderSelects() {
        var options = cityOptions();
        var placeholder = options.length ? 'Selecione a cidade' : 'Nenhuma cidade cadastrada';
        var routeFrom = el('rotaOrigem');
        var routeTo = el('rotaDestino');
        fillSelect(routeFrom, options, options.length ? 'Selecione a origem' : 'Nenhuma cidade cadastrada');
        fillSelect(routeTo, options, options.length ? 'Selecione o destino' : 'Nenhuma cidade cadastrada');
        if (options.length >= 2 && routeFrom && !routeFrom.value) routeFrom.value = options[0].key;
        if (options.length >= 2 && routeTo && !routeTo.value) routeTo.value = options[1].key;
        fillSelect(el('roadFrom'), options, placeholder);
        fillSelect(el('roadTo'), options, placeholder);
    }

    function renderStats() {
        var totalKm = state.roads.reduce(function (sum, road) { return sum + Number(road.distancia || 0); }, 0);
        setText('statCidades', String(state.cities.length));
        setText('statEstradas', String(state.roads.length));
        setText('statKm', totalKm.toLocaleString('pt-BR', { maximumFractionDigits: 0 }));
        setText('citiesCount', String(state.cities.length));
        setText('roadsCount', String(state.roads.length));
        setText('mapSummary', state.cities.length
            ? state.cities.length + ' cidades · ' + state.roads.length + ' estradas'
            : 'Sem dados');
    }

    function renderMap() {
        var host = el('netMap');
        if (!host) return;
        host.innerHTML = '';

        if (!state.cities.length) {
            host.appendChild(emptyNote('Cadastre uma cidade para começar a desenhar a rede.'));
            return;
        }

        var NS = 'http://www.w3.org/2000/svg';
        var width = 640;
        var height = 420;
        var centerX = width / 2;
        var centerY = height / 2;
        var count = state.cities.length;
        var radiusX = count > 1 ? Math.min(225, 90 + count * 16) : 0;
        var radiusY = count > 1 ? Math.min(135, 60 + count * 10) : 0;

        var positions = {};
        state.cities.forEach(function (city, index) {
            var angle = (Math.PI * 2 * index) / count - Math.PI / 2;
            positions[city.key] = {
                x: centerX + Math.cos(angle) * radiusX,
                y: centerY + Math.sin(angle) * radiusY
            };
        });

        var pathNodes = {};
        var pathEdges = {};
        var last = state.lastPath;
        if (last && last.found) {
            last.nodes.forEach(function (key) { pathNodes[key] = true; });
            last.legs.forEach(function (leg) { pathEdges[leg.roadKey] = true; });
        }

        var svg = document.createElementNS(NS, 'svg');
        svg.setAttribute('viewBox', '0 0 ' + width + ' ' + height);
        svg.setAttribute('class', 'net-svg');
        svg.setAttribute('role', 'img');
        svg.setAttribute('aria-label', 'Mapa da rede viária com ' + count + ' cidades');

        state.roads.forEach(function (road) {
            var from = positions[road.origem];
            var to = positions[road.destino];
            if (!from || !to) return;

            var line = document.createElementNS(NS, 'line');
            line.setAttribute('x1', from.x.toFixed(1));
            line.setAttribute('y1', from.y.toFixed(1));
            line.setAttribute('x2', to.x.toFixed(1));
            line.setAttribute('y2', to.y.toFixed(1));
            line.setAttribute('class', 'net-edge' + (pathEdges[road.key] ? ' is-path' : ''));
            svg.appendChild(line);

            var label = document.createElementNS(NS, 'text');
            label.setAttribute('x', ((from.x + to.x) / 2).toFixed(1));
            label.setAttribute('y', ((from.y + to.y) / 2 - 5).toFixed(1));
            label.setAttribute('text-anchor', 'middle');
            label.setAttribute('class', 'net-edge-label' + (pathEdges[road.key] ? ' is-path' : ''));
            label.textContent = Number(road.distancia).toLocaleString('pt-BR') + ' km';
            svg.appendChild(label);
        });

        state.cities.forEach(function (city) {
            var pos = positions[city.key];
            var group = document.createElementNS(NS, 'g');
            group.setAttribute('class', 'net-node' + (pathNodes[city.key] ? ' is-path' : ''));

            var circle = document.createElementNS(NS, 'circle');
            circle.setAttribute('cx', pos.x.toFixed(1));
            circle.setAttribute('cy', pos.y.toFixed(1));
            circle.setAttribute('r', '9');
            group.appendChild(circle);

            var text = document.createElementNS(NS, 'text');
            text.setAttribute('x', pos.x.toFixed(1));
            text.setAttribute('y', (pos.y + 25).toFixed(1));
            text.textContent = city.nome.length > 18 ? city.nome.slice(0, 17) + '…' : city.nome;
            group.appendChild(text);

            svg.appendChild(group);
        });

        host.appendChild(svg);
    }

    function renderCities() {
        var host = el('citiesList');
        if (!host) return;
        host.innerHTML = '';

        if (!state.cities.length) {
            host.appendChild(emptyNote('Nenhuma cidade cadastrada ainda. Use o formulário “Nova cidade”.'));
            return;
        }

        state.cities.forEach(function (city) {
            var connections = state.roads.filter(function (road) {
                return road.origem === city.key || road.destino === city.key;
            }).length;

            var row = document.createElement('div');
            row.className = 'data-row';

            var icon = document.createElement('span');
            icon.className = 'row-icon';
            icon.innerHTML = '<i class="fa-solid fa-city" aria-hidden="true"></i>';

            var body = document.createElement('div');
            body.className = 'min-w-0 flex-1';
            var title = document.createElement('p');
            title.className = 'row-title';
            title.textContent = city.nome;
            var meta = document.createElement('p');
            meta.className = 'row-meta';
            meta.textContent = (city.estado ? city.estado + ' · ' : '') + (connections === 1 ? '1 conexão' : connections + ' conexões');
            body.appendChild(title);
            body.appendChild(meta);

            var btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'btn-icon';
            btn.setAttribute('data-remove-city', city.key);
            btn.setAttribute('aria-label', 'Remover ' + city.nome + ' e suas estradas');
            btn.innerHTML = '<i class="fa-solid fa-trash" aria-hidden="true"></i>';

            row.appendChild(icon);
            row.appendChild(body);
            row.appendChild(btn);
            host.appendChild(row);
        });
    }

    function renderRoads() {
        var host = el('roadsList');
        if (!host) return;
        host.innerHTML = '';

        if (!state.roads.length) {
            host.appendChild(emptyNote('Nenhuma estrada cadastrada ainda. Use o formulário “Nova estrada”.'));
            return;
        }

        state.roads.slice().sort(function (a, b) {
            return (cityName(a.origem) + cityName(a.destino)).localeCompare(cityName(b.origem) + cityName(b.destino), 'pt-BR');
        }).forEach(function (road) {
            var row = document.createElement('div');
            row.className = 'data-row';

            var icon = document.createElement('span');
            icon.className = 'row-icon';
            icon.innerHTML = '<i class="fa-solid fa-road" aria-hidden="true"></i>';

            var body = document.createElement('div');
            body.className = 'min-w-0 flex-1';
            var title = document.createElement('p');
            title.className = 'row-title';
            title.textContent = cityName(road.origem) + ' → ' + cityName(road.destino);
            var meta = document.createElement('p');
            meta.className = 'row-meta';
            meta.textContent = formatKm(road.distancia) + ' · mão dupla';
            body.appendChild(title);
            body.appendChild(meta);

            var btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'btn-icon';
            btn.setAttribute('data-remove-road', road.key);
            btn.setAttribute('aria-label', 'Remover estrada entre ' + cityName(road.origem) + ' e ' + cityName(road.destino));
            btn.innerHTML = '<i class="fa-solid fa-trash" aria-hidden="true"></i>';

            row.appendChild(icon);
            row.appendChild(body);
            row.appendChild(btn);
            host.appendChild(row);
        });
    }

    function showPlaceholder(text) {
        var host = el('routeResult');
        if (!host) return;
        host.innerHTML = '';
        host.appendChild(emptyNote(text));
    }

    function refreshRouteArea() {
        var disabled = state.cities.length < 2;
        var form = el('routeForm');
        var submit = form ? form.querySelector('button[type="submit"]') : null;
        if (submit) submit.disabled = disabled;
        var check = el('checkRouteBtn');
        if (check) check.disabled = disabled;

        if (disabled) {
            showPlaceholder('Cadastre pelo menos duas cidades e uma estrada para calcular rotas.');
        } else if (!state.resultShown) {
            showPlaceholder('Escolha a origem e o destino e clique em “Calcular rota”.');
        }
    }

    function showRoute(result, fromKey, toKey) {
        var host = el('routeResult');
        if (!host) return;
        host.innerHTML = '';

        if (!result || !result.found) {
            var warn = document.createElement('div');
            warn.className = 'result-empty';
            warn.textContent = 'Não existe rota entre ' + cityName(fromKey) + ' e ' + cityName(toKey) + ' com as estradas cadastradas. Cadastre um novo trecho para conectar essas cidades.';
            host.appendChild(warn);
            return;
        }

        var label = document.createElement('p');
        label.className = 'field-label';
        label.textContent = 'Distância total';

        var total = document.createElement('p');
        total.className = 'route-total';
        total.textContent = formatKm(result.total);

        var pathRow = document.createElement('div');
        pathRow.className = 'route-path mt-3';
        result.nodes.forEach(function (key, index) {
            if (index > 0) {
                var arrow = document.createElement('i');
                arrow.className = 'fa-solid fa-arrow-right route-arrow';
                arrow.setAttribute('aria-hidden', 'true');
                pathRow.appendChild(arrow);
            }
            var chip = document.createElement('span');
            chip.className = 'route-node' + (index === result.nodes.length - 1 ? ' is-end' : '');
            chip.textContent = cityName(key);
            pathRow.appendChild(chip);
        });

        var legs = document.createElement('div');
        legs.className = 'leg-list';
        var legsTitle = document.createElement('p');
        legsTitle.className = 'field-label';
        legsTitle.textContent = 'Trechos percorridos';
        legs.appendChild(legsTitle);
        result.legs.forEach(function (leg) {
            var row = document.createElement('div');
            row.className = 'leg-row';
            var left = document.createElement('span');
            left.textContent = cityName(leg.from) + ' → ' + cityName(leg.to);
            var right = document.createElement('span');
            right.textContent = formatKm(leg.dist);
            row.appendChild(left);
            row.appendChild(right);
            legs.appendChild(row);
        });

        var summary = document.createElement('p');
        summary.className = 'field-hint mt-2';
        var totalLegs = result.nodes.length - 1;
        summary.textContent = totalLegs === 1 ? '1 trecho percorrido.' : totalLegs + ' trechos percorridos.';

        host.appendChild(label);
        host.appendChild(total);
        host.appendChild(pathRow);
        host.appendChild(legs);
        host.appendChild(summary);
    }

    function showCheck(info, fromKey, toKey) {
        var host = el('routeResult');
        if (!host) return;
        host.innerHTML = '';

        var box = document.createElement('div');
        box.className = 'result-empty';
        var icon = document.createElement('i');
        icon.className = 'fa-solid ' + (info.exists ? 'fa-circle-check' : 'fa-circle-xmark');
        icon.setAttribute('aria-hidden', 'true');
        var text = document.createElement('p');
        text.className = 'mt-2';
        text.textContent = info.exists
            ? 'Existe conexão entre ' + cityName(fromKey) + ' e ' + cityName(toKey) + ', com ' + info.hops + (info.hops === 1 ? ' trecho no caminho mais curto em número de conexões.' : ' trechos no caminho mais curto em número de conexões.')
            : 'Não existe conexão entre ' + cityName(fromKey) + ' e ' + cityName(toKey) + ' com as estradas cadastradas.';
        box.appendChild(icon);
        box.appendChild(text);
        host.appendChild(box);
    }

    function showSameCity() {
        state.lastPath = null;
        state.resultShown = true;
        renderMap();
        var host = el('routeResult');
        if (!host) return;
        host.innerHTML = '';
        var box = document.createElement('div');
        box.className = 'result-empty';
        box.textContent = 'Escolha duas cidades diferentes para origem e destino.';
        host.appendChild(box);
    }

    function handleRouteSubmit(ev) {
        ev.preventDefault();
        if (!window.RotaGraph) return;
        var fromKey = el('rotaOrigem').value;
        var toKey = el('rotaDestino').value;
        if (!fromKey || !toKey) {
            toast('Selecione a cidade de origem e a de destino.', 'error');
            return;
        }
        if (fromKey === toKey) {
            showSameCity();
            return;
        }
        var adjacency = window.RotaGraph.build(state.cities, state.roads);
        var result = window.RotaGraph.shortestPath(adjacency, state.cities, fromKey, toKey);
        state.lastPath = result;
        state.resultShown = true;
        renderMap();
        showRoute(result, fromKey, toKey);
    }

    function handleCheck() {
        if (!window.RotaGraph) return;
        var fromKey = el('rotaOrigem').value;
        var toKey = el('rotaDestino').value;
        if (!fromKey || !toKey) {
            toast('Selecione a cidade de origem e a de destino.', 'error');
            return;
        }
        if (fromKey === toKey) {
            showSameCity();
            return;
        }
        var adjacency = window.RotaGraph.build(state.cities, state.roads);
        var info = window.RotaGraph.connectivity(adjacency, fromKey, toKey);
        state.lastPath = null;
        state.resultShown = true;
        renderMap();
        showCheck(info, fromKey, toKey);
    }

    function handleCitySubmit(ev) {
        ev.preventDefault();
        var nameInput = el('cityName');
        var stateInput = el('cityState');
        var nome = (nameInput.value || '').trim();
        var estado = (stateInput.value || '').trim();

        if (nome.length < 2) {
            toast('Informe o nome da cidade com pelo menos 2 letras.', 'error');
            nameInput.focus();
            return;
        }
        var duplicated = state.cities.some(function (city) { return normalize(city.nome) === normalize(nome); });
        if (duplicated) {
            toast('Essa cidade já está cadastrada.', 'error');
            nameInput.focus();
            return;
        }

        DataSystem.set(NS_CITIES, makeKey('cidade'), { nome: nome, estado: estado }).then(function (res) {
            if (!res || !res.success) throw new Error('Não foi possível salvar a cidade.');
            nameInput.value = '';
            stateInput.value = '';
            state.resultShown = false;
            state.lastPath = null;
            toast('Cidade “' + nome + '” cadastrada.', 'ok');
            return loadData();
        }).catch(function (err) {
            toast(err && err.message ? err.message : 'Falha ao salvar a cidade.', 'error');
        });
    }

    function handleRoadSubmit(ev) {
        ev.preventDefault();
        var fromKey = el('roadFrom').value;
        var toKey = el('roadTo').value;
        var kmInput = el('roadKm');
        var kmValue = Number(String(kmInput.value || '').replace(',', '.'));

        if (!fromKey || !toKey) {
            toast('Selecione a cidade de origem e a de destino.', 'error');
            return;
        }
        if (fromKey === toKey) {
            toast('A origem e o destino precisam ser cidades diferentes.', 'error');
            return;
        }
        if (!Number.isFinite(kmValue) || kmValue <= 0) {
            toast('Informe a distância em quilômetros, maior que zero.', 'error');
            kmInput.focus();
            return;
        }
        var duplicated = state.roads.some(function (road) {
            return (road.origem === fromKey && road.destino === toKey) || (road.origem === toKey && road.destino === fromKey);
        });
        if (duplicated) {
            toast('Já existe uma estrada entre essas cidades. Remova a antiga para atualizar a distância.', 'error');
            return;
        }

        DataSystem.set(NS_ROADS, makeKey('estrada'), {
            origem: fromKey,
            destino: toKey,
            distancia: Math.round(kmValue * 10) / 10
        }).then(function (res) {
            if (!res || !res.success) throw new Error('Não foi possível salvar a estrada.');
            kmInput.value = '';
            state.resultShown = false;
            state.lastPath = null;
            toast('Estrada cadastrada com ' + formatKm(kmValue) + '.', 'ok');
            return loadData();
        }).catch(function (err) {
            toast(err && err.message ? err.message : 'Falha ao salvar a estrada.', 'error');
        });
    }

    function requestRemoveCity(cityKey) {
        var city = cityByKey(cityKey);
        if (!city) return;
        var linked = state.roads.filter(function (road) {
            return road.origem === cityKey || road.destino === cityKey;
        });

        askConfirm({
            title: 'Remover ' + city.nome + '?',
            body: linked.length
                ? 'Também serão removidas ' + linked.length + ' estrada(s) ligada(s) a essa cidade.'
                : 'Essa cidade não possui estradas ligadas a ela.',
            acceptLabel: 'Remover cidade'
        }).then(function (ok) {
            if (!ok) return;
            var chain = Promise.resolve();
            linked.forEach(function (road) {
                chain = chain.then(function () { return DataSystem.delete(NS_ROADS, road.key); });
            });
            chain.then(function () { return DataSystem.delete(NS_CITIES, cityKey); })
                .then(function () {
                    state.resultShown = false;
                    state.lastPath = null;
                    toast('Cidade removida do grafo.', 'ok');
                    return loadData();
                })
                .catch(function (err) {
                    toast(err && err.message ? err.message : 'Falha ao remover a cidade.', 'error');
                });
        });
    }

    function removeRoad(roadKey) {
        DataSystem.delete(NS_ROADS, roadKey).then(function (res) {
            if (!res || !res.success) throw new Error('Não foi possível remover a estrada.');
            state.resultShown = false;
            state.lastPath = null;
            toast('Estrada removida.', 'ok');
            return loadData();
        }).catch(function (err) {
            toast(err && err.message ? err.message : 'Falha ao remover a estrada.', 'error');
        });
    }

    function resetSystem() {
        askConfirm({
            title: 'Reiniciar o sistema?',
            body: 'Serão apagadas ' + state.cities.length + ' cidade(s) e ' + state.roads.length + ' estrada(s) cadastradas.',
            acceptLabel: 'Apagar tudo'
        }).then(function (ok) {
            if (!ok) return;
            var chain = Promise.resolve();
            state.roads.forEach(function (road) {
                chain = chain.then(function () { return DataSystem.delete(NS_ROADS, road.key); });
            });
            state.cities.forEach(function (city) {
                chain = chain.then(function () { return DataSystem.delete(NS_CITIES, city.key); });
            });
            chain.then(function () {
                state.resultShown = false;
                state.lastPath = null;
                toast('Sistema reiniciado. A rede está vazia.', 'ok');
                return loadData();
            }).catch(function (err) {
                toast(err && err.message ? err.message : 'Falha ao limpar os dados.', 'error');
            });
        });
    }

    function loadSample() {
        askConfirm({
            title: 'Recarregar dados de exemplo?',
            body: 'As cidades e estradas de exemplo que ainda não existirem serão adicionadas à rede atual.',
            acceptLabel: 'Adicionar exemplo'
        }).then(function (ok) {
            if (!ok) return;
            var chain = Promise.resolve();

            SAMPLE_CITIES.forEach(function (city) {
                var exists = state.cities.some(function (item) { return normalize(item.nome) === normalize(city.nome); });
                if (exists) return;
                chain = chain.then(function () {
                    return DataSystem.set(NS_CITIES, makeKey('cidade'), { nome: city.nome, estado: city.estado });
                });
            });

            chain.then(function () { return loadData(); }).then(function () {
                var roadChain = Promise.resolve();
                SAMPLE_ROADS.forEach(function (sample) {
                    var from = state.cities.filter(function (city) { return normalize(city.nome) === normalize(sample.de); })[0];
                    var to = state.cities.filter(function (city) { return normalize(city.nome) === normalize(sample.para); })[0];
                    if (!from || !to) return;
                    var exists = state.roads.some(function (road) {
                        return (road.origem === from.key && road.destino === to.key) || (road.origem === to.key && road.destino === from.key);
                    });
                    if (exists) return;
                    roadChain = roadChain.then(function () {
                        return DataSystem.set(NS_ROADS, makeKey('estrada'), { origem: from.key, destino: to.key, distancia: sample.km });
                    });
                });
                return roadChain;
            }).then(function () {
                state.resultShown = false;
                state.lastPath = null;
                toast('Rede de exemplo carregada.', 'ok');
                return loadData();
            }).catch(function (err) {
                toast(err && err.message ? err.message : 'Falha ao carregar o exemplo.', 'error');
            });
        });
    }

    var confirmResolver = null;

    function closeConfirm(value) {
        var dialog = el('confirmDialog');
        if (dialog && dialog.open) dialog.close();
        if (confirmResolver) {
            var resolve = confirmResolver;
            confirmResolver = null;
            resolve(value);
        }
    }

    function askConfirm(options) {
        var dialog = el('confirmDialog');
        if (!dialog || typeof dialog.showModal !== 'function') {
            return Promise.resolve(window.confirm(options.title + ' ' + options.body));
        }
        setText('confirmTitle', options.title);
        setText('confirmBody', options.body);
        setText('confirmAccept', options.acceptLabel || 'Confirmar');
        return new Promise(function (resolve) {
            confirmResolver = resolve;
            dialog.showModal();
        });
    }

    function initDialog() {
        var dialog = el('confirmDialog');
        if (!dialog) return;
        var accept = el('confirmAccept');
        var cancel = el('confirmCancel');
        if (accept) accept.addEventListener('click', function () { closeConfirm(true); });
        if (cancel) cancel.addEventListener('click', function () { closeConfirm(false); });
        dialog.addEventListener('cancel', function (ev) {
            ev.preventDefault();
            closeConfirm(false);
        });
        dialog.addEventListener('click', function (ev) {
            if (ev.target === dialog) closeConfirm(false);
        });
    }

    function initMenu() {
        var toggle = el('menuToggle');
        var panel = el('mobileMenu');
        if (!toggle || !panel) return;

        function close() {
            panel.classList.remove('is-open');
            toggle.setAttribute('aria-expanded', 'false');
        }

        toggle.addEventListener('click', function () {
            var open = panel.classList.toggle('is-open');
            toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
        });
        panel.addEventListener('click', function (ev) {
            if (ev.target.closest('a')) close();
        });
        document.addEventListener('keydown', function (ev) {
            if (ev.key === 'Escape') close();
        });
        document.addEventListener('click', function (ev) {
            if (!panel.classList.contains('is-open')) return;
            if (panel.contains(ev.target) || toggle.contains(ev.target)) return;
            close();
        });
    }

    function initForms() {
        var routeForm = el('routeForm');
        if (routeForm) routeForm.addEventListener('submit', handleRouteSubmit);

        var checkBtn = el('checkRouteBtn');
        if (checkBtn) checkBtn.addEventListener('click', handleCheck);

        var swapBtn = el('swapRouteBtn');
        if (swapBtn) {
            swapBtn.addEventListener('click', function () {
                var from = el('rotaOrigem');
                var to = el('rotaDestino');
                if (!from || !to) return;
                var temp = from.value;
                from.value = to.value;
                to.value = temp;
            });
        }

        var cityForm = el('cityForm');
        if (cityForm) cityForm.addEventListener('submit', handleCitySubmit);

        var roadForm = el('roadForm');
        if (roadForm) roadForm.addEventListener('submit', handleRoadSubmit);

        var citiesHost = el('citiesList');
        if (citiesHost) {
            citiesHost.addEventListener('click', function (ev) {
                var btn = ev.target.closest('[data-remove-city]');
                if (!btn) return;
                requestRemoveCity(btn.getAttribute('data-remove-city'));
            });
        }

        var roadsHost = el('roadsList');
        if (roadsHost) {
            roadsHost.addEventListener('click', function (ev) {
                var btn = ev.target.closest('[data-remove-road]');
                if (!btn) return;
                removeRoad(btn.getAttribute('data-remove-road'));
            });
        }

        var resetBtn = el('resetSystemBtn');
        if (resetBtn) resetBtn.addEventListener('click', resetSystem);

        var sampleBtn = el('loadSampleBtn');
        if (sampleBtn) sampleBtn.addEventListener('click', loadSample);
    }

    initMenu();
    initDialog();
    initForms();
    loadData();
});