// Explain: Graph algorithms for shortest path and connectivity.
window.RotaGraph = {
    build: function (cities, roads) {
        var adjacency = {};
        (cities || []).forEach(function (city) {
            adjacency[city.key] = [];
        });
        (roads || []).forEach(function (road) {
            if (!adjacency[road.origem] || !adjacency[road.destino]) return;
            var weight = Number(road.distancia);
            if (!Number.isFinite(weight) || weight <= 0) return;
            adjacency[road.origem].push({ to: road.destino, dist: weight, roadKey: road.key });
            adjacency[road.destino].push({ to: road.origem, dist: weight, roadKey: road.key });
        });
        return adjacency;
    },

    shortestPath: function (adjacency, cities, startKey, endKey) {
        var keys = (cities || []).map(function (city) { return city.key; });
        if (!adjacency[startKey] || !adjacency[endKey]) {
            return { found: false, total: 0, nodes: [], legs: [] };
        }

        var distances = {};
        var previous = {};
        var visited = {};

        keys.forEach(function (key) { distances[key] = Infinity; });
        distances[startKey] = 0;

        for (var step = 0; step < keys.length; step += 1) {
            var current = null;
            var best = Infinity;

            keys.forEach(function (key) {
                if (!visited[key] && distances[key] < best) {
                    best = distances[key];
                    current = key;
                }
            });

            if (current === null) break;
            visited[current] = true;
            if (current === endKey) break;

            (adjacency[current] || []).forEach(function (edge) {
                var candidate = distances[current] + edge.dist;
                if (candidate < distances[edge.to]) {
                    distances[edge.to] = candidate;
                    previous[edge.to] = { from: current, roadKey: edge.roadKey, dist: edge.dist };
                }
            });
        }

        if (!Number.isFinite(distances[endKey])) {
            return { found: false, total: 0, nodes: [], legs: [] };
        }

        var nodes = [endKey];
        var legs = [];
        var cursor = endKey;
        var guard = 0;

        while (previous[cursor] && guard < keys.length) {
            var prev = previous[cursor];
            legs.unshift({ from: prev.from, to: cursor, dist: prev.dist, roadKey: prev.roadKey });
            nodes.unshift(prev.from);
            cursor = prev.from;
            guard += 1;
        }

        return { found: true, total: distances[endKey], nodes: nodes, legs: legs };
    },

    connectivity: function (adjacency, startKey, endKey) {
        if (!adjacency[startKey] || !adjacency[endKey]) return { exists: false, hops: 0 };
        if (startKey === endKey) return { exists: true, hops: 0 };

        var queue = [{ key: startKey, hops: 0 }];
        var seen = {};
        seen[startKey] = true;

        for (var i = 0; i < queue.length; i += 1) {
            var item = queue[i];
            var neighbours = adjacency[item.key] || [];
            for (var j = 0; j < neighbours.length; j += 1) {
                var next = neighbours[j].to;
                if (seen[next]) continue;
                if (next === endKey) return { exists: true, hops: item.hops + 1 };
                seen[next] = true;
                queue.push({ key: next, hops: item.hops + 1 });
            }
        }

        return { exists: false, hops: 0 };
    }
};