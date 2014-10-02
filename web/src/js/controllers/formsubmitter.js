var controllers = require('../../lib/controllers.js');
var support = require('../../lib/support');
var Loader = require('../../lib/loader');
var el = support.el;
var els = support.els;
var socket = require('../../lib/socket');
helpers = require('../../lib/handlebarsHelpers')

var FormSubmitterController = function(container, data){
  var self = this;
  var target = container.dataset.target;
  var message = container.dataset.message;
  var doConfirm = function(message, callback){
    alertify.confirm(message, callback);
  };
  var processAction = function(form, buttons, method, action, target){
    buttons.forEach(function(button){
      button.disabled = true;
    });
    if(method==='post'){
      return Loader.postForm(form, function(err, response){
        buttons.forEach(function(button){
          button.disabled = false;
        });
        if(err){
          return alertify.error(err.error||err.stack||err);
        }
        if(message && alertify){
          alertify.success(message, 1000);
        }
        window.location.href=target.replace(/{(.+)}/, function(match, token){
          return response[token];
        });
      });
    }
    Loader[method](action, function(err, response){
      buttons.forEach(function(button){
        button.disabled = false;
      });
      if(err){
        return alertify.error(err.error||err.stack||err);
      }
      window.location.href=target.replace(/{(.+)}/, function(match, token){
        return response[token];
      });
    });
  };
  var handleSubmit = self.handleSubmit = function(e){
    if(e.target && (e.target.nodeName === 'FORM') || (e.target.nodeName === 'BUTTON')){
      var form = el(container, 'form')||container;
      var buttons = els(container, 'button');
      var method = (e.target.nodeName === 'BUTTON'?e.target.dataset.method||'POST':'POST').toLowerCase();
      var action = e.target.nodeName === 'BUTTON'?e.target.dataset.action||form.action:form.action;
      var tgt = e.target.nodeName === 'BUTTON'?e.target.dataset.target||target:target;
      var confirm = e.target.nodeName === 'BUTTON'?e.target.dataset.confirm:false;
      e.preventDefault();
      if(confirm){
        return alertify.confirm(confirm, function(ok){
          if(ok){
            processAction(form, buttons, method, action, tgt);
          }
        });
      }
      processAction(form, buttons, method, action, tgt);
    }
  };
  container.addEventListener('submit', handleSubmit);
  container.addEventListener('click', handleSubmit);
};

FormSubmitterController.prototype.teardown = function(container){
  var self = this;
  container.removeEventListener('submit', self.handleSubmit);
  container.removeEventListener('click', self.handleSubmit);
};

controllers.register('FormSubmitter', FormSubmitterController);
