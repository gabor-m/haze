var http = require('http');
var child_process = require('child_process');

var TIMEOUT = 10; // sec

http.createServer(function (req, res) {
    res.writeHead(200, { 'Content-Type': 'text/plain', 'Access-Control-Allow-Origin':'*' });
    if (req.method.toLowerCase() === 'post') {
        var body = '';
        req.on('data', function (data) {
            body += data.toString();
        });
        req.on('end', function () {
            var child = child_process.spawn("node", ["haze.js", body.replace(/[\r\n]/g, '\n')], {
                timeout: 1 // ms
            });
            // console.log(body);
            child.stdout.on('data', function (data) {
                data = data.toString();
                res.write(data);
            });
            child.stdout.on('end', function (data) {
                res.end();
            });
            setTimeout(function () {      
                child.kill();
                if (!res.finished) {
                    res.write("timeout");
                    res.end();
                }
            }, TIMEOUT * 1000);
        });
        
    } else {
        res.end();
    }
}).listen(9561);

