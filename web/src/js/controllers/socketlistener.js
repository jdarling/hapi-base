var controllers = require('../../lib/controllers.js');
var support = require('../../lib/support');
var el = support.el;
var socket = require('../../lib/socket');
helpers = require('../../lib/handlebarsHelpers')

var SocketListenerController = function(container, data){
  var self = this;
  var src = container.innerHTML;
  var message = container.dataset.message;
  var template = Handlebars.compile(src);
  var handleMessage = self.handleMessage = function(status){
    container.innerHTML = template(status, {helpers: helpers});
  };
  socket.on(message, handleMessage);
  if(data){
    return handleMessage(data);
  }
  self.message = message;
  container.innerHTML = '';
};

SocketListenerController.prototype.teardown = function(){
  var self = this;
  socket.removeListener(self.message, self.handleMessage);
};

controllers.register('SocketListener', SocketListenerController);
