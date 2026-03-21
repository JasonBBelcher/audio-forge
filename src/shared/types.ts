export enum IPCChannel {
  // YouTube
  YOUTUBE_GET_INFO = 'youtube:getInfo',
  YOUTUBE_DOWNLOAD = 'youtube:download',
  YOUTUBE_CANCEL = 'youtube:cancel',
  YOUTUBE_SEARCH = 'youtube:search',

  // Audio
  AUDIO_ANALYZE = 'audio:analyze',
  AUDIO_CONVERT = 'audio:convert',
  AUDIO_STEMS = 'audio:stems',
  AUDIO_TRIM = 'audio:trim',
  AUDIO_NORMALIZE = 'audio:normalize',

  // Video
  VIDEO_EXTRACT_AUDIO = 'video:extractAudio',
  VIDEO_REPLACE_AUDIO = 'video:replaceAudio',
  VIDEO_TRIM = 'video:trim',
  VIDEO_THUMBNAILS = 'video:thumbnails',

  // Sync
  SYNC_FIND_OFFSET = 'sync:findOffset',
  SYNC_APPLY = 'sync:apply',
  SYNC_REPORT = 'sync:report',
  SYNC_MANUAL = 'sync:manual',

  // Platforms
  PLATFORM_CONNECT = 'platforms:connect',
  PLATFORM_DISCONNECT = 'platforms:disconnect',
  PLATFORM_UPLOAD = 'platforms:upload',
  PLATFORM_SEARCH = 'platforms:search',

  // Files
  FILES_LIST = 'files:list',
  FILES_SEARCH = 'files:search',
  FILES_DELETE = 'files:delete',
  FILES_RESTORE = 'files:restore',
  FILES_ORGANIZE = 'files:organize',

  // Projects
  PROJECTS_CREATE = 'projects:create',
  PROJECTS_GET = 'projects:get',
  PROJECTS_ADD_ASSET = 'projects:addAsset',
  PROJECTS_EXPORT = 'projects:export',

  // Jobs
  JOBS_LIST = 'jobs:list',
  JOBS_CANCEL = 'jobs:cancel',
  JOBS_GET_STATUS = 'jobs:getStatus',

  // Settings
  SETTINGS_GET = 'settings:get',
  SETTINGS_SET = 'settings:set',

  // Health
  HEALTH_GET_STATUS = 'health:getStatus',

  // Hardware
  HARDWARE_LIST_ADAPTERS = 'hardware:listAdapters',
  HARDWARE_GET_STATUS = 'hardware:getAdapterStatus',
  HARDWARE_LIST_DEVICES = 'hardware:listDevices',

  // MIDI
  MIDI_LIST_DEVICES = 'midi:listDevices',
  MIDI_START_CAPTURE = 'midi:startCapture',
  MIDI_STOP_CAPTURE = 'midi:stopCapture',
  MIDI_SEND_SYSEX = 'midi:sendSysex',
}

export enum EventChannel {
  JOB_PROGRESS = 'job:progress',
  JOB_COMPLETE = 'job:complete',
  JOB_FAILED = 'job:failed',
  HEALTH_CHANGED = 'health:changed',
  HARDWARE_DEVICE_CHANGED = 'hardware:deviceChanged',
  HARDWARE_MIDI_MESSAGE = 'hardware:midiMessage',
  UPDATE_AVAILABLE = 'update:available',
}
