'use strict';

const request = require('request-promise');
const converter = require('rel-to-abs');
const fs = require('fs');
const index = fs.readFileSync('index.html', 'utf8');
const ResponseBuilder = require('./app/ResponseBuilder');

module.exports = app => {
    app.all('/*', (req, res) => {
        const responseBuilder = new ResponseBuilder(res);

        const requestedUrl = req.url.slice(1);
        const corsBaseUrl = '//' + req.get('host');

        console.info(req.method + ' ' + req.protocol + '://' + req.get('host') + req.url);

        if(requestedUrl == ''){
            res.send(index);
            return;
        }

        let headers = Object.assign({}, req.headers);

        // This prevents "Error [ERR_TLS_CERT_ALTNAME_INVALID]: Hostname/IP does not match certificate's altnames: Host: localhost"
        delete headers.host;

        // This prevents "Received response with content-encoding: gzip, but failed to decode it"
        delete headers['accept-encoding'];

        request({
            method: req.method,
            uri: requestedUrl,
            resolveWithFullResponse: true,
            headers: headers,
            simple: false,  // Don't catch() unsuccessful HTTP response codes
        })
        .then(originResponse => {
            responseBuilder
                .addHeaderByKeyValue('Access-Control-Allow-Origin', '*')
                .addHeaderByKeyValue('Access-Control-Allow-Credentials', false)
                .addHeaderByKeyValue('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With')
                .addHeaderByKeyValue('X-Proxied-By', 'cors-container')
                .build(originResponse.headers);
            if(req.headers['rewrite-urls']){
                res.status(originResponse.statusCode).send(
                    converter
                        .convert(originResponse.body, requestedUrl)
                        .replace(requestedUrl, corsBaseUrl + '/' + requestedUrl)
                );
            }else{
                res.status(originResponse.statusCode).send(originResponse.body);
            }
        })
        .catch(reason => {
            console.error(reason);
            responseBuilder
                .addHeaderByKeyValue('Access-Control-Allow-Origin', '*')
                .addHeaderByKeyValue('Access-Control-Allow-Credentials', false)
                .addHeaderByKeyValue('Access-Control-Allow-Headers', 'Content-Type')
                .addHeaderByKeyValue('X-Proxied-By', 'cors-container')
                .build({});

            return res.status(500).send("CORS Proxy Failed");
        });
    });
};
