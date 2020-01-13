'use strict';

const request = require('request-promise');
const converter = require('rel-to-abs');
const fs = require('fs');
const index = fs.readFileSync('index.html', 'utf8');
const ResponseBuilder = require('./app/ResponseBuilder');

module.exports = app => {
    app.get('/*', (req, res) => {
        const responseBuilder = new ResponseBuilder(res);

        const requestedUrl = req.url.slice(1);
        const corsBaseUrl = '//' + req.get('host');

        console.info(req.protocol + '://' + req.get('host') + req.url);

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
            uri: requestedUrl,
            resolveWithFullResponse: true,
            headers: headers,
        })
        .then(originResponse => {
            responseBuilder
                .addHeaderByKeyValue('Access-Control-Allow-Origin', '*')
                .addHeaderByKeyValue('Access-Control-Allow-Credentials', false)
                .addHeaderByKeyValue('Access-Control-Allow-Headers', 'Content-Type')
                .addHeaderByKeyValue('X-Proxied-By', 'cors-container')
                .build(originResponse.headers);
            if(req.headers['rewrite-urls']){
                res.send(
                    converter
                        .convert(originResponse.body, requestedUrl)
                        .replace(requestedUrl, corsBaseUrl + '/' + requestedUrl)
                );
            }else{
                res.send(originResponse.body);
            }
        })
        .catch(originResponse => {
            responseBuilder
                .addHeaderByKeyValue('Access-Control-Allow-Origin', '*')
                .addHeaderByKeyValue('Access-Control-Allow-Credentials', false)
                .addHeaderByKeyValue('Access-Control-Allow-Headers', 'Content-Type')
                .addHeaderByKeyValue('X-Proxied-By', 'cors-containermeh')
                .build(originResponse.headers);

            res.status(originResponse.statusCode || 500);

            return res.send(originResponse.message);
        });
    });
};
