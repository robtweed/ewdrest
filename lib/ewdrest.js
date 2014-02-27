// Build 4
// 27 February 2014

var restify = require('restify');
var client = require('ewdliteclient');
var url = require('url');
var util = require('util');
var EWD;

var parser = function(req, res, next) {
  //console.log(util.inspect(req));
  var destination = req.params[0];
  var destinationObj = EWD.server[destination];
  if (typeof destinationObj !== 'undefined') {
    var service = req.params[1].split('/')[0];
    var serviceObj = EWD.service[service];
    if (typeof serviceObj !== 'undefined') {

      req.ewd = {
        server: destination,
        module: serviceObj.module,
        serviceName: serviceObj.service,
        config: destinationObj
      };

      res.header('Content-Type', serviceObj.contentType || 'text/plain');

      var args = {
        host: destinationObj.host,
        port: destinationObj.port,
        ssl: destinationObj.ssl,
        appName: serviceObj.module,
        serviceName: serviceObj.service,
        params: {
          rest_url: 'http://' + req.headers.host + req.url,
          rest_path: req.params[1],
          rest_auth: req.header('Authorization') || '',
          rest_method: req.method
        },
        secretKey: destinationObj.secretKey
      };
      for (var name in req.query) {
        args.params[name] = req.query[name];
      }
      args.params.accessId = destinationObj.accessId;
      if (req.body) args.params.ewd_body = JSON.stringify(req.body);

      client.run(args, function(error, data) {
        if (error) {
          console.log('error: ' + JSON.stringify(error));
          var statusCode;
          var message;
          if (error.code && error.message) {
            statusCode = error.message.statusCode || 400;
            message = error.message;
          }
          else if (!error.error.statusCode) {
            statusCode = 400;
            message = error.error;
          }
          else {
            statusCode = error.error.statusCode;
            message = error.error.text;
          }
          res.send(new restify.RestError({
            statusCode: statusCode,
            restCode: 'ProcessingError',
            message: message
          }));
        }
        else {
          res.send(data);
        }
      });
    }
    else {
      return next(new restify.RestError({
        statusCode: 404,
        restCode: 'InvalidRESTService',
        message: 'Invalid REST Service Specified'
      }));
    }
  }
  else {
    return next(new restify.RestError({
      statusCode: 404,
      restCode: 'InvalidRemoteServer',
      message: 'Invalid Remote Server Specified'
    }));
  }
};


module.exports = {

  start: function(params) {
    var server = restify.createServer(params.restServer);
    server.use(restify.acceptParser(server.acceptable));
    server.use(restify.bodyParser());
    server.use(restify.queryParser());
    EWD = params;
 
    server.get(/^\/([a-zA-Z0-9_\.~-]+)\/(.*)/, parser);
    server.post(/^\/([a-zA-Z0-9_\.~-]+)\/(.*)/, parser);
    server.put(/^\/([a-zA-Z0-9_\.~-]+)\/(.*)/, parser);
    server.del(/^\/([a-zA-Z0-9_\.~-]+)\/(.*)/, parser);

    server.listen(params.restPort, function() {
      console.log('%s listening at %s', server.name, server.url);
    });

  }
};
