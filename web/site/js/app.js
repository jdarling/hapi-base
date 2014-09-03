(function(global){
  var ControllerNotFoundException = function(controllerName){
    var self = this;
    self.name = 'ControllerNotFoundException';
    self.message = 'Controller "'+controllerName+'" not registered';
  }
  ControllerNotFoundException.prototype = Object.create(Error.prototype);

  var Controllers = function(){
    this._controllers = {};
  };

  Controllers.prototype.create = function(container, controllerName, data){
    var Controller = this._controllers[controllerName];
    if(!Controller){
      throw new ControllerNotFoundException(controllerName);
    }
    return container.controller = new Controller(container, data);
  };

  Controllers.prototype.register = function(controllerName, controller){
    this._controllers[controllerName] = controller;
  };

  var cleanupControllers = function (e) {
    var walkForRemoval = function(node){
      if(node && node.children){
        var i, l = node.children.length, child;
        for(i=0; i<l; i++){
          child = node.children[i];
          walkForRemoval(child);
        }
      }
      if(node.controller){
        if(node.controller.teardown){
          node.controller.teardown();
        }
        delete node.controller;
      }
    };
    if(e.type=='DOMNodeRemoved'){
      var n = e.target;
      walkForRemoval(n);
    }
  };

  document.body.addEventListener('DOMNodeRemoved', cleanupControllers, true);
  
  var controllers = global.controllers = controllers || new Controllers();
})(this);

(function(global){
  var containerIdx = 0;
  
  var helpers = global.handlebarsHelpers = {
    JSONstringify: function(data){
      return JSON.stringify(data, null, '  ');
    },
    limit: function(ary, max, options) {
      if(!ary || ary.length == 0){
        return options.inverse(this);
      }
      var result = [ ];
      for(var i = 0; i < max && i < ary.length; ++i){
        result.push(options.fn(ary[i]));
      }
      return result.join('');
    },
    isComplex: function(obj){
      if(typeof(obj)==='object'){
        return true;
      }
      return false;
    },
    ifComplex: function(obj, options){
      if(typeof(obj)==='object'){
        return options.fn(this);
      }
      return options.inverse(this);
    },
    notPrivate: function(data, options){
      var res = {}, key;
      for(key in data){
        if(key.substr(0,1)!=='_'){
          res[key] = data[key];
        }
      }
      return options.fn(res);
    },
    keys: function(what, options){
      return options.fn(Object.keys(what));
    },
    eachKeys: function(what, options){
      var keys = Object.keys(what||{});
      var ret = '';
      keys.forEach(function(key){
        ret += options.fn({key: key, value: what[key]});
      });
      return ret;
    },
    getval: function(from, key, def){
      return from[key]||def||'';
    },
    properCase: function(val){
      var result = (val||'').replace( /([A-Z])/g, " $1");
      var finalResult = result.charAt(0).toUpperCase() + result.slice(1);
      return finalResult;
    },
    embed: function(name, scope){
      var id = 'component_'+(containerIdx++);
      var controllerName = el('#'+name).getAttribute('data-controller');
      if(controllerName){
        var html = '<div id="'+id+'"></div>';
        setTimeout((function(id, controllerName, scope){
          return function(){
            var pane = el('#'+id);
            controllers.create(pane, controllerName, {data: scope, template: el('#'+name).innerHTML});
          }
        })(id, controllerName, scope), 10);
      }else{
        html = template(scope, {helpers: handlebarsHelpers});
      }
      return new Handlebars.SafeString(html);
    },
    qrcode: function(data, size){
      var id = 'component_'+(containerIdx++);
      setTimeout((function(id){
        return function(){
          var qrcode = new QRCode(id, {
            width: size,
            height: size
          });
          qrcode.makeCode(data);
        }
      })(id), 10);
      return new Handlebars.SafeString('<div id="'+id+'"></div>');
    },
    log: function(what){
      console.log(what);
      return;
    },
    moment: function(dt, f){
      return moment(dt).format(f);
    },
  };
  var key;
  for(key in Handlebars.helpers){
    helpers[key] = helpers[key] || Handlebars.helpers[key];
  }
})(this);
/*****************************************************************************\
  options
    uri: {}      - key value paris of data to send in url/get/uri
    data: {}||'' - Object or string to be sent as JSON data in the body
                   for methods that support body data
    dataType: '' - Data type that is being sent, by default application/json
                   is used.  If you use anything but json|jsonp|application/json
                   make sure your data is already encoded properly as a string
  
  Loader.get(uri, options, callback)
  
  Loader.post(uri, options, callback)
  
  Loader.put(uri, options, callback)
  
  Loader.delete(uri, options, callback)
  
\*****************************************************************************/
({define:typeof define!=="undefined"?define:function(deps, factory){
  if(typeof(module)!=='undefined'){
    module.exports = factory();
  }else{
    window.Loader = factory();
  }
}}).
define([], function(){
  var Loader = {};
  var callhashlist = [], callbacks = [];

  Loader.dataTypes={
    'json': 'application/json',
    'jsonp': 'application/json'
  };
  
  var addCallback = function(hash, callback){
    var idx = callhashlist.indexOf(hash), found = idx>-1;
    if(!found){
      idx = callhashlist.length;
      callhashlist[idx] = hash;
      callbacks[idx]=[];
    }
    callbacks[idx].push(callback);
    return found;
  };
  
  var callCallbacks = function(hash, err, results){
    var idx = callhashlist.indexOf(hash), cbs, i, l;
    if(idx>-1){
      cbs = (callbacks.splice(idx, 1)||[])[0]||[];
      callhashlist.splice(idx, 1);
      l = cbs.length;
      for(i=0; i<l; i++){
        cbs[i](err, results);
      }
    };
  };

  var RemoteRequest = function(){
    var activexmodes=["Msxml2.XMLHTTP", "Microsoft.XMLHTTP"];
    if (window.ActiveXObject){
      for (var i=0; i<activexmodes.length; i++){
        try{
          return new ActiveXObject(activexmodes[i])
        }catch(e){
          //suppress error
        }
      }
    }else if (window.XMLHttpRequest){
      return new XMLHttpRequest()
    }
    return false
  };
  
  var encodeParams = function(args){
    var key, s=[], i, l;
    var addParam = function(key, value){
      value = value instanceof Function?value():(value===null?'':value);
      s[s.length]=encodeURIComponent(key)+'='+encodeURIComponent(value);
    };
    if(args instanceof Array){
      l = args.length;
      for(i=0; i<l; i++){
        addParam(args[i].name, args[i].value);
      }
    }else if(args){
      for(key in args){
        addParam(key, args[key]);
      }
    }
    return s.join('&').replace(/%20/g, '+');
  };
  
  var defineMethod = function(HTTPMethod){
    Loader[HTTPMethod] = function(resourceURI, options, callback){
      var getParams='', requestData, callHash, url = resourceURI;
      var requestObject, response, items, body, dataType;
      if(typeof(options)==='function'){
        callback = options;
        options = {};
      }
      callback=callback||function(){};
      options=options||{};
      if(typeof(options.uri)==='string'){
        try{
          options.uri=JSON.parse(options.uri);
        }catch(e){}
      }
      options.uri=options.uri||{};
      callHash = resourceURI+JSON.stringify(options.uri)+JSON.stringify(options.data);
      if(!addCallback(callHash, callback)){
        options.uri.ts = new Date();
        url += ((url||'').indexOf('?')===-1?'?':'&') + encodeParams(options.uri);
        requestObject = new RemoteRequest();
        
        requestObject.onreadystatechange=function(){
          if(requestObject.readyState===4){
            if (requestObject.status===200 || window.location.href.indexOf("http")===-1){
              try{
                response = JSON.parse(requestObject.responseText);
              }catch(e){
                response = requestObject.responseText;
              }
              if(response.error||response.errors){
                callCallbacks(callHash, response);
              }else{
                items=response[response.root];
                try{
                  response = (items instanceof Array)?{
                    items: items,
                    offset: response.offset,
                    limit: response.limit,
                    count: response.count,
                    length: items.length
                  }:items||response;
                }catch(e){
                }
                callCallbacks(callHash, null, response);
              }
            }else{
              var err = new Error(requestObject.statusText+': '+(requestObject.responseText||requestObject.response));
              err.type = requestObject.statusText;
              err.code = requestObject.status;
              err.requestObject = requestObject;
              callCallbacks(callHash, err);
            }
          }
        };
        
        requestObject.open(HTTPMethod.toUpperCase(), url, true);
        if(options.data){
          dataType=Loader.dataTypes[options.dataType]||options.dataType||"application/json";
          if(options.data instanceof FormData){
            body = options.data;
          }else{
            requestObject.setRequestHeader("Content-type", dataType);
            try{
              body = JSON.stringify(options.data);
            }catch(e){
              body = options.body;
            };
          }
          if(options.headers){
            (function(){
              var key;
              for(key in options.headers){
                try{
                  requestObject.setRequestHeader(key, options.headers[key]);
                }catch(e){}
              }
            })();
          }
          requestObject.send(body);
        }else{
          requestObject.send(null);
        }
      }
    };
  };
  
  Loader.postForm = function(form, callback){
		var formData = new FormData(form);
    
    var callHash = form.action + (new Date()).getTime();
    if(!addCallback(callHash, callback)){
      var requestObject = new RemoteRequest();
      requestObject.onreadystatechange=function(){
        if(requestObject.readyState===4){
          if (requestObject.status===200 || window.location.href.indexOf("http")===-1){
            try{
              response = JSON.parse(requestObject.responseText);
            }catch(e){
              response = requestObject.responseText;
            }
            if(response.error||response.errors){
              callCallbacks(callHash, response);
            }else{
              items=response[response.root];
              try{
                response = (items instanceof Array)?{
                  items: items,
                  offset: response.offset,
                  limit: response.limit,
                  count: response.count,
                  length: items.length
                }:items||response;
              }catch(e){
              }
              callCallbacks(callHash, null, response);
            }
          }else{
            var err = new Error(requestObject.statusText+': '+(requestObject.responseText||requestObject.response));
            err.type = requestObject.statusText;
            err.code = requestObject.status;
            err.requestObject = requestObject;
            callCallbacks(callHash, err);
          }
        }
      };
      requestObject.open('POST', form.action, true);
      requestObject.send(formData);
    }
		return false;
  };
  
  (function(methods, callback){
    var i, l=methods.length;
    for(i=0; i<l; i++){
      callback(methods[i]);
    }
  })(['get', 'post', 'put', 'delete'], defineMethod);
  return Loader;
});

(function(global){
  var Partials = global.Partials = function(options){
    var self = this;
    self.options = options;
    self.options.ext = self.options.ext || ".html";
    self.options.path = self.options.path || "/partials/";
  };

  Partials.prototype.set = function(templateName, source){
    var elem = el('#'+templateName);
    if(!elem){
      elem = document.createElement('script');
      elem.setAttribute('type', 'text/x-template');
      elem.setAttribute('id', templateName);
      document.getElementsByTagName('head').item(0).appendChild(elem);
    }
    elem.innerHTML = source;
    Handlebars.registerPartial(templateName, Handlebars.compile(source));
  };

  Partials.prototype.get = function(templateName, callback){
    var self = this;
    var elem = el('#'+templateName);
    if(!elem){
      elem = document.createElement('script');
      elem.setAttribute('type', 'text/x-template');
      elem.setAttribute('id', templateName);
      document.getElementsByTagName('head').item(0).appendChild(elem);
    }
    if(!elem.innerHTML){
      Loader.get(self.options.path+templateName+self.options.ext, function(err, template){
        if(err){
          return callback(err);
        }
        elem.innerHTML = template;
        try{
          self.set(templateName, elem.innerHTML);
          callback(null, Handlebars.partials[templateName]);
        }catch(e){
          callback(e, Handlebars.partials[templateName]);
        }
      });
    }else{
      try{
        if(!Handlebars.partials[templateName]){
          self.set(templateName, elem.innerHTML);
        }
        callback(null, Handlebars.partials[templateName]);
      }catch(e){
        callback(e, Handlebars.partials[templateName]);
      }
    }
  };

  Partials.prototype.preload = function(callback){
    var self = this;
    var toLoad = 1;
    var doneLoading = function(){
      toLoad--;
      if(toLoad<1){
        setTimeout(callback, 1);
      }
    };
    els('[type="text/x-template"]').forEach(function(elem){
      var templateName = elem.getAttribute('id');
      toLoad++;
      self.get(templateName, doneLoading);
    });
    doneLoading();
  };
})(this);
var Record = function(data){
  var self = this, keys = self.keys = new Array(), key;
  self._listeners = {};
  self._data = data;
};

Record.prototype.on = function(event, handler){
  self._listeners[event] = self._listeners[event] || [];
  self._listeners[event].push(handler);
};

Record.prototype.off = function(event, handler){
  var result = false;
  if(self._listeners[event] instanceof Array){
    if(handler){
      var i, l = self._listeners[event].length;
      for(i=l; i>-1; --i){
        if(self._listeners[event][i]===handler){
          self._listeners[event].splice(i, 1);
          result = true;
        }
      }
    }else{
      delete self._listeners[event];
      self._listeners[event] = false;
      result = true;
    }
  }
  return result;
};

Record.prototype.handle = function(event, data){
  var self = this, handlers = self._listeners[event] || [], i, l = handlers.length;
  for(i=0; i<l; i++){
    handlers[i].call(self, data);
  }
};

Record.prototype.raw = function(){
  var self = this;
  return self._data;
};

Record.prototype.get = function(key){
  var self = this;
  return self._data[key];
};

Record.prototype.set = function(key, value){
  var self = this;
  self._data[key] = value;
  self.handle('updated', key);
  return value;
};

Record.prototype.remove = function(key){
  var self = this;
  delete self._data[key];
  self.handle('removed', key);
  return value;
};

Record.prototype.update = function(update){
  var self = this, key;
  for(key in update){
    self._data[key] = update[key];
  }
  self.handle('updated');
};

Record.prototype.toString = function(){
  var self = this;
  return JSON.stringify(self._data);
};

var Store = function(options){
  var self = this;
  self.records = new Array();
  self._updates = 0;
  self._listeners = {};
  self.options = options || {};
};

Store.prototype.on = function(event, handler){
  self._listeners[event] = self._listeners[event] || [];
  self._listeners[event].push(handler);
};

Store.prototype.off = function(event, handler){
  var result = false;
  if(self._listeners[event] instanceof Array){
    if(handler){
      var i, l = self._listeners[event].length;
      for(i=l; i>-1; --i){
        if(self._listeners[event][i]===handler){
          self._listeners[event].splice(i, 1);
          result = true;
        }
      }
    }else{
      delete self._listeners[event];
      self._listeners[event] = false;
      result = true;
    }
  }
  return result;
};

Store.prototype.handle = function(event, data){
  var self = this, handlers = self._listeners[event] || [], i, l = handlers.length;
  for(i=0; i<l; i++){
    handlers[i].call(self, data);
  }
};

Store.prototype.beginUpdate = function(){
  var self = this;
  self._updates++;
};

Store.prototype.endUpdate = function(){
  var self = this;
  if(self._updates){
    self._updates--;
    if(self._updates==0){
      self.handle('updated');
    }
  }
};

Store.prototype.insert = function(rec){
  var self = this, record = new Record(rec);
  self.records.push(record);
  self.handle('inserted', record);
};

Store.prototype.find = function(query){
  var self = this;
  return sift(query, self.records);
};

Store.prototype.get = function(id){
  var self = this, records = self.find({_id: id});
  return records.length?records[0]:false;
};

Store.prototype.update = function(id, rec){
  var self = this;
  if(rec === void 0){
    id = rec._id || rec.name;
  }
  rec._id = id || rec._id || rec.name;
  if(record = self.get(id)){
    record.update(rec);
    return true;
  }
  return false;
};

Store.prototype.upsert = function(rec){
  var self = this;
  if(!self.update(rec._id, rec)){
    self.insert(rec);
  }
  return self;
};

(function(global){
  global.el = function(src, sel){
    if(!sel){
      sel = src;
      src = document;
    }
    return src.querySelector(sel);
  };

  global.els = function(src, sel){
    if(!sel){
      sel = src;
      src = document;
    }
    return Array.prototype.slice.call(src.querySelectorAll(sel));
  };

  global.val = function(from){
    return from.value||from.getAttribute('value')||from.innerText||from.innerHTML;
  };

  global.pkg = function(from){
    var result = {};
    from.forEach(function(e){
      result[e.getAttribute('name')] = val(e);
    });
    return result;
  };
})(this);
var SampleController = function(container, data){
  container.innerHTML = container.dataset.content;
};

controllers.register('SampleController', SampleController);

(function(global){
  var socket = window.socket = io();
  var partials = global.partials = new Partials({
    path: "partials/",
    ext: ".html"
  });

  var Application = global.Application = function(){
    var self = this;
    partials.preload(function(){
      self.init();
    });
  };

  Application.prototype.displayPage = function(pageName, data){
    var path = pageName.split('/');
    var nav = path.shift();

    partials.get(pageName, function(err, template){
      if(err){
        var error = new Error(pageName + ': ' + err);
        error.page = pageName;
        error.source = template;
        throw error;
      }
      try{
        var pane = el('#outlet');
        var controllerName = el('#'+pageName).getAttribute('data-controller');
        if(nav==='index'){
          nav = el('nav li a[href="#home"]');
        }else{
          nav = el('nav li a[href="#'+(nav||'home')+'"]');
        }
        pane.innerHTML = template(data||{}, {helpers: handlebarsHelpers});
        if(controllerName){
          controllers.create(pane, controllerName, data);
        }
        var elm, elms = els(pane, '[data-controller]'), i, l=elms.length;
        for(i=0; i<l; i++){
          elm = elms[i];
          controllerName = elm.getAttribute('data-controller');
          controllers.create(elm, controllerName, data);
        }
      }catch(e){
        throw e;
      }
    });
  };

  Application.prototype.init = function(){
    var app = this;
    var nav = Satnav({
      html5: false,
      force: true,
      poll: 100
    });

    nav
      .navigate({
        path: '/',
        directions: function(params){
          app.displayPage('home');
        }
      })
      ;

    var e = els('script[nav]'), i=0, l=e.length;
    for(; i<l; i++){
      nav = nav.navigate(
        (function(id, linkTo, dataApi){
          return {
            path: linkTo,
            directions: dataApi?function(params){
              var uri = dataApi.replace(/{([^}]+)}/g,  function(full, sym){
                return params[sym];
              });
              Loader.get(uri, function(err, data){
                app.displayPage(id, err||data);
              });
            }:function(params){
              app.displayPage(id);
            }
          }
        })(e[i].getAttribute('id'), e[i].getAttribute('nav'), e[i].getAttribute('data-api'))
      );
    }

    nav
      .change(function(params, old){
        app.displayPage('loading');
        nav.resolve();
        return this.defer;
      })
      .otherwise('/');
      ;
    nav.go();
  };

  var app = global.app = new Application();
})(this);
