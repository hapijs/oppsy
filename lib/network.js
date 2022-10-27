'use strict';

const Http = require('http');
const Https = require('https');

const internals = {};


module.exports = internals.Network = class {

    constructor(server, httpAgents, httpsAgents) {

        this._requests = {
            total: 0,
            disconnects: 0,
            statusCodes: {},
            activeRequests: 0
        };
        this._responseTimes = {
            count: 0,
            total: 0,
            max: 0
        };
        this._server = server;
        this._httpAgents = [].concat(httpAgents || Http.globalAgent);
        this._httpsAgents = [].concat(httpsAgents || Https.globalAgent);

        this._server.ext('onRequest', (request, h) => {

            this._requests.total++;
            this._requests.activeRequests++;

            request.events.once('disconnect', () => {

                this._requests.disconnects++;
            });

            return h.continue;
        });
        this._server.events.on('response', (request) => {

            const msec = Date.now() - request.info.received;
            const statusCode = request.response && request.response.statusCode;

            this._responseTimes.count++;
            this._responseTimes.total += msec;

            if (this._responseTimes.max < msec) {
                this._responseTimes.max = msec;
            }

            if (statusCode) {
                this._requests.statusCodes[statusCode] = this._requests.statusCodes[statusCode] || 0;
                this._requests.statusCodes[statusCode]++;
            }

            this._requests.activeRequests--;
        });

        this.requests = () => {

            return this._requests;
        };

        this.responseTimes = () => {

            if (this._responseTimes.count === 0) {
                return {
                    avg: null,
                    max: null
                };
            }

            return {
                avg: this._responseTimes.total / this._responseTimes.count,
                max: this._responseTimes.max
            };
        };

        this.sockets = () => {

            return {
                http: internals.Network.getSocketCount(this._httpAgents),
                https: internals.Network.getSocketCount(this._httpsAgents)
            };
        };

        this.reset = () => {

            this._requests = {
                total: 0,
                disconnects: 0,
                statusCodes: {},
                activeRequests: this._requests.activeRequests
            };
            this._responseTimes = {
                count: 0,
                total: 0,
                max: 0
            };

        };
    }

    static getSocketCount(agents) {

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
    }
};
