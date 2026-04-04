// src/scheduler/types.ts
export var ScheduleType;
(function (ScheduleType) {
    ScheduleType["CRON"] = "cron";
    ScheduleType["INTERVAL"] = "interval";
    ScheduleType["ONE_TIME"] = "one-time";
})(ScheduleType || (ScheduleType = {}));
export var ExecutorMode;
(function (ExecutorMode) {
    ExecutorMode["STANDALONE"] = "standalone";
    ExecutorMode["INTEGRATED"] = "integrated";
})(ExecutorMode || (ExecutorMode = {}));
