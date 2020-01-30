var http = require('http');
var child_process = require('child_process');

http.createServer(function (req, res) {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    if (req.method.toLowerCase() === 'post') {
        var body = '';
        req.on('data', function (data) {
            body += data.toString();
        });
        req.on('end', function () {
            var child = child_process.spawn("node", ["haze.js", body.replace(/[\r\n]/g, '\n')], {
                timeout: 10000 // ms
            });
            child.stdout.on('data', function (data) {
                data = data.toString();
                res.write(data);
            });
            child.stdout.on('end', function (data) {
                res.end();
            });
        });
        
    } else {
        res.end();
    }
}).listen(9561);

