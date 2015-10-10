
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

    var EVENT_START = 'timer_start',
        EVENT_STOP = 'timer_stop',
        EVENT_RESET = 'timer_reset',
        EVENT_TICK_SECONDS = 'timer_ontick_seconds',
        EVENT_TICK_MINUTES = 'timer_ontick_minutes',
        EVENT_TICK_HOURS = 'timer_ontick_hours';

    var intervalValue = 0,
        intervalLastMinute = 0, // we save last broadcasted minutes value
        intervalLastHour = 0, // we save last broadcasted hours value
        intervalID = null,
        intervalStart = null,
        intervalPreviousTime = null,
        statusCode = STATUS_STOPPED,
        eventsPrefix = '', // events for broadcasting
        events = {
            start: EVENT_START,
            stop: EVENT_STOP,
            reset: EVENT_RESET,
            tick_seconds: EVENT_TICK_SECONDS,
            tick_minutes: EVENT_TICK_MINUTES,
            tick_hours: EVENT_TICK_HOURS,
        },
        configs = {
            // timerId is required during event broadcasting
            // so receiver could know which timer triggered
            timerId: '',

            // callbacks to be called on specified events
            // properties: Arrays by eventName
            callbacks: {},

            // broadcasting options time specific events are 
            // disabled due to performance issues
            // properties: Booleans by eventName
            broadcasts: {},
        };

    function debug(txt) {
        console.log('TimerObject > ' + txt);
    }

    // this function is used to calculate passed time in intervalFunction,
    // as $interval fires approximate to 1000, it may occure at 1001, 1002 or 999
    function convertToSeconds(mls) {
        var s = (mls - mls % 1000) / 1000,
            ms = mls % 1000;
        if (ms == 0)
            return s;
        if (ms >= 500)
            return s + 1;
        return s;
    }

    function execute(eventName, data) {
        var clbks = configs.callbacks[eventName],
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
                clbk(eventName, clbks_data);
            }
        }
    }

    function broadcast(eventName, data) {
        if (configs.broadcasts[eventName]) {
            $rootScope.$broadcast(eventName, angular.copy({
                timerId: configs.timerId,
                currentValue: intervalValue,
            }, data));    
        }
    }

    function sendUpdates(eventName, data) {
        execute(eventName, data);
        broadcast(eventName, data);
    }

    function intervalFunction(count, forced) {
        
        var now = new Date().getTime(),
            passed = 0;

        // moment.diff('seconds') function gives 0 when time is 999ms
        passed = convertToSeconds(now - intervalPreviousTime);

        intervalValue += passed;

        // debug('passed = ' + passed + '; diff = ' + (now - intervalPreviousTime));

        if (!forced) {
            sendUpdates(events.tick_seconds, {});

            passedMinutes = (intervalValue - intervalValue % 60) / 60;
            passedHours = (passedMinutes - passedMinutes % 60) / 60;

            if (intervalLastMinute != passedMinutes) {
                sendUpdates(events.tick_minutes, {});
                intervalLastMinute = passedMinutes;
            }
            if (intervalLastHour != passedHours) {
                sendUpdates(events.tick_hours, {});
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
        
        // Basic member initialization
        for (var eventIndex in events) {
            var eventName = events[eventIndex];
            configs.callbacks[eventName] = [];
            configs.broadcasts[eventName] = false;
        }

        if (!options) {
            return;
        }

        // Merging according our copy of configs
        if (options.callbacks) {
            for (var evnt in configs.callbacks) {
                if (options.callbacks[evnt]) {
                    this.registerCallback(evnt, options.callbacks[evnt])
                }
            }
        }
        if (options.broadcasts) {
            for (var evnt in configs.broadcasts) {
                if (options.broadcasts[evnt]) {
                    configs.broadcasts[evnt] = (options.broadcasts[evnt] && options.broadcasts[evnt] != 'false') ? true : false;
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
     * @initValue: value to count timer from
     * @silent: mode not to send any updates
     * 
     **/
    this.start = function(initValue, silent) {
        if (angular.isDefined(initValue) &&  !isNaN(initValue)) {
            intervalValue = initValue;
        }

        if (statusCode == STATUS_STARTED) {
            return;
        }

        statusCode = STATUS_STARTED;
        intervalStart = new Date().getTime();
        intervalPreviousTime = intervalStart;

        if (intervalID)
            $interval.cancel(intervalID);
        intervalID = $interval(intervalFunction, 1000); // per second

        if (!silent) {
            sendUpdates(events.start, {
                startTime: intervalStart
            });
        }
    };

    /**
     * Stop timer
     * 
     * @silent: mode not to sendUpdates events or run callbacks
     * 
     **/
    this.stop = function(silent) {
        statusCode = STATUS_STOPPED;
        if (intervalID) {
            $interval.cancel(intervalID);
        }

        if (!silent) {
            sendUpdates(events.stop, {
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
        intervalLastMinute = 0;
        intervalLastHour = 0;
        this.stop(true);
        sendUpdates(events.reset, {});
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
     * @eventName: index of callbacks
     * @callback: function to be called
     * @return: callbackId to unregister callback
     * 
     **/
    this.registerCallback = function(eventName, callback) {
        if (!callback || !angular.isFunction(callback)) {
            throw 'TimerFactory: only functions can be registered as callback';
        }
        if (!configs.callbacks[eventName] || !angular.isArray(configs.callbacks[eventName])) {
            throw 'TimerFactory: timer first should be initialized correctly, configs.callbacks is not valid array';
        }
        var index = configs.callbacks[eventName].length;
        configs.callbacks[eventName].push(callback);
        return eventName + '_' + index;
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
            throw 'TimerFactory: failed to unregister callback, invalid callbackId';
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
        return angular.copy(events);
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