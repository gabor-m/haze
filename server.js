var fs = require('fs');
var http = require('http');
var child_process = require('child_process');
var crypto = require('crypto')

var TIMEOUT = 10; // sec

function sha1(str) {
    var shasum = crypto.createHash('sha1');
    shasum.update(str);
    return shasum.digest('hex');
}

http.createServer(function (req, res) {
    res.writeHead(200, { 'Content-Type': 'text/plain', 'Access-Control-Allow-Origin':'*' });
    if (req.method.toLowerCase() === 'post') {
        var body = '';
        req.on('data', function (data) {
            body += data.toString();
        });
        req.on('end', function () {
            if (body.indexOf("%save") === 0) {
                body = body.substr(5);
                var filename = sha1(body);
                var path = "./saved/" + filename + ".hz";
                if (!fs.existsSync(path)) {
                    fs.writeFileSync(path, body, "utf8");
                }
                res.write(filename);
                res.end();
            } else if (body.indexOf("%get") === 0) {
                body = body.substr(4);
                var path = "./saved/" + body + ".hz";
                if (body.length !== 40 || !fs.existsSync(path)) {
                    res.write('');
                } else {
                    res.write(fs.readFileSync(path, 'utf8'));
                }
                res.end();
            } else {
                var child = child_process.spawn("node", ["haze.js", body.replace(/[\r\n]/g, '\n')]);
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
            }
        });
        
    } else {
        res.end();
    }
}).listen(9561);

