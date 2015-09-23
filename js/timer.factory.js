
/*!
 * Copyright 2014 ShaderZAK Co.
 * https://github.com/shaderzak/
 *
 * ngRedTimer, v0.0.1-cherry
 * AngularJS non-singleton flexible timer module
 *
 * By @shaderzak
 *
 * Licensed under the MIT license.
 *
 */
 
window.TimerObject = function TimerObject($injector, $timeout, $interval, $localStorage, $rootScope) {

    var STATUS_STOPPED = 0,
        STATUS_STARTED = 1,
        STATUS_PAUSED = 2;

    var intervalValue = 0,
        intervalLastMinute = 0, // we save last broadcasted minutes value
        intervalLastHour = 0, // we save last broadcasted hours value
        intervalID = null,
        intervalStart = null,
        intervalPreviousTime = null,
        statusCode = STATUS_STOPPED,
        eventsPrefix = 'timer_', // events for broadcasting
        events = {
            start: 'start',
            stop: 'stop',
            reset: 'reset',
            tick_seconds: 'ontick_seconds',
            tick_minutes: 'ontick_minutes',
            tick_hours: 'ontick_hours',
        },
        configs = {

            // timerId is required during event broadcasting
            // so receiver could know which timer triggered
            timerId: '',

            // callbacks to be called on specified events
            callbacks: {
                'start': [],
                'stop': [],
                'reset': [],
                'ontick_seconds': [],
                'ontick_minutes': [],
                'ontick_hours': [],
            },
        };

    var defaultOptions = {
        timerId: 'timer-global-id',
        callbacks: {},
    };

    function runCallbacks(event, data) {
        var clbks = configs.callbacks[event],
            clbks_data = angular.copy({
                timerId: configs.timerId,
                currentValue: intervalValue
            }, data);

        if (!clbks || !angular.isArray(clbks)) {
            return;
        }

        for (var idx = 0; idx < clbks.length; idx++) {
            var clbk = clbks[idx];
            if (clbk && angular.isFunction(clbk)) {
                clbk(data);
            }
        }
    }

    function broadcast(event, data) {
        runCallbacks(event, data);
        $rootScope.$broadcast(eventsPrefix + event, angular.copy({
            timerId: configs.timerId,
            currentValue: intervalValue,
        }, data));
    }

    function intervalFunction(count, forced) {
        // console.log('TimerService: interval function called');

        var now = moment(),
            passed = now.diff(intervalPreviousTime, 'seconds');

        intervalValue += passed;

        if (!forced) {
            broadcast(events.tick_seconds, {});
            passedMinutes = (intervalValue - intervalValue % 60) / 60;
            passedHours = (passedMinutes - passedMinutes % 60) / 60;

            if (intervalLastMinute != passedMinutes) {
                broadcast(events.tick_minutes, {});
                intervalLastMinute = passedMinutes;
            }
            if (intervalLastHour != passedHours) {
                broadcast(events.tick_hours, {});
                intervalLastHour = passedHours;
            }
        }
        intervalPreviousTime = now;
    }

    /**
     * Initialize timer object
     * 
     * @options: 
     * 
     **/
    this.init = function(options) {
        if (!options) {
            return;
        }
        // merging according our copy of progressCallback
        if (options.callbacks) {
            for (var evnt in configs.callbacks) {
                if (options.callbacks[evnt]) {
                    this.registerCallback(evnt, options.callbacks[evnt])
                }
            }
        }
        if (options.timerId) {
            configs.timerId = options.timerId;
        }
    };

    /**
     * Start timer
     * 
     * @initValue:
     * @silent: 
     * 
     **/
    this.start = function(initValue, silent) {
        if (initValue && initValue > 0) {
            intervalValue = initValue;
        }

        if (statusCode == STATUS_STARTED) {
            return;
        }

        statusCode = STATUS_STARTED;
        intervalStart = moment();
        intervalPreviousTime = intervalStart;

        if (intervalID)
            $interval.cancel(intervalID);
        intervalID = $interval(intervalFunction, 1000); // per second
        if (!silent)
            broadcast(events.start, {
                startTime: intervalStart
            });
    };

    /**
     * Stop timer
     * 
     * @silent: mode not to broadcast events or run callbacks
     * 
     **/
    this.stop = function(silent) {
        statusCode = STATUS_STOPPED;
        if (intervalID) {
            $interval.cancel(intervalID);
            if (!silent)
                broadcast(events.stop, {
                    stopTime: moment()
                });
        }
    };

    /**
     * Reset timer
     * 
     **/
    this.reset = function() {
        intervalValue = 0;
        this.stop(true);
        broadcast(events.reset, {});
    };

    /**
     * Force is an interface to allow callers check status forcfully
     * e.g. after application was suspended by Cordova
     *
     **/
    this.force = function() {
        if (statusCode == STATUS_STARTED)
            intervalFunction(0, true);
    };


    /**
     * Public setter/getter for intervalValue
     * 
     * @v: current value
     **/
    this.setValue = function(v) {
        intervalValue = v;
    };
    this.getValue = function() {
        return intervalValue;
    };

    /**
     * Check the current status of timer
     * 
     * @return: true if timer is running
     * 
     **/
    this.isRunning = function() {
        return statusCode == STATUS_STARTED;
    };

    /**
     * Registers callback for progress updates
     * 
     * @type: index of callbacks
     * @callback: function to be called
     * @return: callbackId to unregister callback
     * 
     **/
    this.registerCallback = function(type, callback) {
        if (!callback || !angular.isFunction(callback)) {
            throw 'TimerService: onyl functions can be registered as callback';
        }
        var index = configs.callbacks[type].length;
        configs.callbacks[type].push(callback);
        return type + '_' + index;
    };

    /**
     * Unregisters callback for progress updates
     *
     * @callbackId: id returned by registerCallback
     * @return: unregistered callback function
     * 
     **/
    this.unregisterCallback = function(callbackId) {
        var callbackId_a = callbackId.split('_', 2);

        if (callbackId_a.length < 2)
            throw 'TimerService: failed to unregister callback, invalid callbackId';
        return configs.callbacks[callbackId_a[0]].splice(callbackId_a[1], 1);
    };

    /**
     * Generating unique Id for timer
     * 
     * @alias: prefix for id (optional)
     * @return: unique Id
     *
     **/
    this.generateTimerId = function(alias) {
        if (angular.isUndefined(alias)) {
            alias = 'timer';
        }
        var key = "";
        var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
        for (var i = 0; i < 5; i++)
            key += possible.charAt(Math.floor(Math.random() * possible.length));
        return alias + '-' + new Date().getTime() + '-' + key;
    };

    /**
     * Get for private events object
     * 
     * @return: event names
     * 
     **/
    this.getEvents = function() {
        var r = angular.copy(events);
        for (var i in r) {
            r[i] = eventsPrefix + r[i];
        }
        return r;
    };

    /**
     * Should be replaced with more generic function
     * 
     * 
     **/
    this.roundToMinutes = function(s) {
        if (isNaN(s))
            return 0;
        var m = 0;
        if (s <= 0) return 0;
        // if we have even 1sec round it to 1m
        if (s <= 60) return 60;

        if (s % 60 <= 30) {
            m = (s - s % 60);
        } else {
            m = (s + (60 - s % 60));
        }
        return m;
    };
};

window.TimerObject['$inject'] = ['$injector', '$timeout', '$interval', '$localStorage', '$rootScope'];

angular.module('ngRedTimer', [])
    .factory('TimerFactory', ['$injector', '$timeout', '$interval', '$localStorage', '$rootScope',
        function($injector, $timeout, $interval, $localStorage, $rootScope) {
            return function() {
                return $injector.instantiate(window.TimerObject);
            };
        }
    ]);