'use strict';

// Load modules

const Http = require('http');
const Https = require('https');

const Hoek = require('hoek');
const Items = require('items');

class Network {
    constructor(server/*, httpAgents, httpsAgents */) {

        this._requests = {};
        this._responseTimes = {};
        this._server = server;
        this._httpAgents = [].concat(arguments[1] || Http.globalAgent);
        this._httpAgents = [].concat(arguments[2] || Https.globalAgent);

        this._server.on('request-internal', this._onRequest.bind(this));
        this._server.on('response', this._onResponse.bind(this));
    }
    _onRequest(request, event, tags) {

        const port = request.connection.info.port;

        if (tags.received) {
            this._requests[port] = this._requests[port] || { total: 0, disconnects: 0, statusCodes: {} };
            this._requests[port].total++;

            request.once('disconnect', () => {

                this._requests[port].disconnects++;
            });
        }
    }
    _onResponse(request) {

        const msec = Date.now() - request.info.received;
        const port = request.connection.info.port;
        const statusCode = request.response && request.response.statusCode;

        this._responseTimes[port] = this._responseTimes[port] || { count: 0, total: 0, max: 0 };
        this._responseTimes[port].count++;
        this._responseTimes[port].total += msec;

        if (this._responseTimes[port].max < msec) {
            this._responseTimes[port].max = msec;
        }

        if (statusCode) {
            this._requests[port].statusCodes[statusCode] = this._requests[port].statusCodes[statusCode] || 0;
            this._requests[port].statusCodes[statusCode]++;
        }
    }
    reset() {

        const ports = Object.keys(this._requests);
        for (let i = 0; i < ports.length; ++i) {
            this._requests[ports[i]] = { total: 0, disconnects: 0, statusCodes: {} };
            this._responseTimes[ports[i]] = { count: 0, total: 0, max: 0 };
        }
    }
    requests(callback) {

        callback(null, this._requests);
    }
    concurrents(callback) {

        const result = {};

        Items.serial(this._server.connections, (connection, next) => {

            connection.listener.getConnections((err, count) => {

                if (err) {
                    return next(err);
                }

                result[connection.info.port] = count;
                next();
            });
        }, (err) => {

            callback(err, result);
        });
    }
    responseTimes(callback) {

        const ports = Object.keys(this._responseTimes);
        const overview = {};
        for (let i = 0; i < ports.length; ++i) {
            const port = ports[i];
            const count = Hoek.reach(this, '_responseTimes.' + port + '.count', { default: 1 });
            overview[port] = {
                avg: this._responseTimes[port].total / count,
                max: this._responseTimes[port].max
            };
        }

        return callback(null, overview);
    }
    sockets(callback) {

        const result = {
            http: Network.getSocketCount(this._httpAgents),
            https: Network.getSocketCount(this._httpAgents)
        };
        callback(null, result);
    }
}

Network.getSocketCount = (agents) => {

    const result = {
        total: 0
    };

    for (let i = 0; i < agents.length; ++i) {
        const agent = agents[i];

        const keys = Object.keys(agent.sockets);
        for (let j = 0; j < keys.length; ++j) {
            const key = keys[j];
            result[key] = agent.sockets[key].length;
            result.total += result[key];
        }
    }

    return result;
};

module.exports = Network;
