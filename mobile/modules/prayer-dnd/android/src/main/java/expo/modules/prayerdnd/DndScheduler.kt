package expo.modules.prayerdnd

import android.app.AlarmManager
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build

/**
 * Turns Do Not Disturb on at the start of each prayer window and off at the end, using
 * AlarmManager so it works while the app is closed.
 *
 * We only ever turn DND off if we were the ones who turned it on, so a user's own DND is left alone.
 */
object DndScheduler {
  const val ACTION_ON = "expo.modules.prayerdnd.DND_ON"
  const val ACTION_OFF = "expo.modules.prayerdnd.DND_OFF"

  private const val PREFS = "prayer_dnd"
  private const val KEY_COUNT = "scheduled_windows"
  private const val KEY_WE_ENABLED = "we_enabled"

  fun hasAccess(context: Context): Boolean = notificationManager(context).isNotificationPolicyAccessGranted

  fun schedule(context: Context, windows: List<Pair<Long, Long>>) {
    cancelAll(context)
    val now = System.currentTimeMillis()
    windows.forEachIndexed { i, (start, end) ->
      if (end <= now) return@forEachIndexed
      if (start <= now) enable(context) else setAlarm(context, start, pendingIntent(context, ACTION_ON, i * 2))
      setAlarm(context, end, pendingIntent(context, ACTION_OFF, i * 2 + 1))
    }
    prefs(context).edit().putInt(KEY_COUNT, windows.size).apply()
  }

  fun cancelAll(context: Context) {
    val am = alarmManager(context)
    val count = prefs(context).getInt(KEY_COUNT, 0)
    for (i in 0 until count) {
      am.cancel(pendingIntent(context, ACTION_ON, i * 2))
      am.cancel(pendingIntent(context, ACTION_OFF, i * 2 + 1))
    }
    prefs(context).edit().putInt(KEY_COUNT, 0).apply()
    // If we're in the middle of a window, give the phone back its normal mode.
    disable(context)
  }

  fun enable(context: Context) {
    val nm = notificationManager(context)
    if (!nm.isNotificationPolicyAccessGranted) return
    if (nm.currentInterruptionFilter == NotificationManager.INTERRUPTION_FILTER_ALL) {
      nm.setInterruptionFilter(NotificationManager.INTERRUPTION_FILTER_PRIORITY)
      prefs(context).edit().putBoolean(KEY_WE_ENABLED, true).apply()
    }
  }

  fun disable(context: Context) {
    val nm = notificationManager(context)
    val prefs = prefs(context)
    if (!prefs.getBoolean(KEY_WE_ENABLED, false)) return
    if (nm.isNotificationPolicyAccessGranted &&
      nm.currentInterruptionFilter == NotificationManager.INTERRUPTION_FILTER_PRIORITY
    ) {
      nm.setInterruptionFilter(NotificationManager.INTERRUPTION_FILTER_ALL)
    }
    prefs.edit().putBoolean(KEY_WE_ENABLED, false).apply()
  }

  private const val KEY_SESSION_PREVIOUS = "session_previous_filter"

  /**
   * While the Namaz Assistant is leading a prayer: "Alarms only", so no calls, messages or notifications get
   * through (media keeps playing, so the recitation is still heard). The phone's own filter is remembered and
   * put back by [endSession].
   */
  fun startSession(context: Context): Boolean {
    val nm = notificationManager(context)
    if (!nm.isNotificationPolicyAccessGranted) return false
    val prefs = prefs(context)
    if (!prefs.contains(KEY_SESSION_PREVIOUS)) {
      prefs.edit().putInt(KEY_SESSION_PREVIOUS, nm.currentInterruptionFilter).apply()
    }
    nm.setInterruptionFilter(NotificationManager.INTERRUPTION_FILTER_ALARMS)
    return true
  }

  fun endSession(context: Context) {
    val nm = notificationManager(context)
    val prefs = prefs(context)
    if (!prefs.contains(KEY_SESSION_PREVIOUS)) return
    val previous = prefs.getInt(KEY_SESSION_PREVIOUS, NotificationManager.INTERRUPTION_FILTER_ALL)
    if (nm.isNotificationPolicyAccessGranted &&
      nm.currentInterruptionFilter == NotificationManager.INTERRUPTION_FILTER_ALARMS
    ) {
      nm.setInterruptionFilter(previous)
    }
    prefs.edit().remove(KEY_SESSION_PREVIOUS).apply()
  }

  private fun setAlarm(context: Context, at: Long, pi: PendingIntent) {
    val am = alarmManager(context)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && !am.canScheduleExactAlarms()) {
      am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi)
    } else {
      am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi)
    }
  }

  private fun pendingIntent(context: Context, action: String, requestCode: Int): PendingIntent {
    val intent = Intent(context, DndReceiver::class.java).setAction(action)
    return PendingIntent.getBroadcast(
      context,
      requestCode,
      intent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )
  }

  private fun prefs(context: Context) = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
  private fun alarmManager(context: Context) = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
  private fun notificationManager(context: Context) =
    context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
}

class DndReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    when (intent.action) {
      DndScheduler.ACTION_ON -> DndScheduler.enable(context)
      DndScheduler.ACTION_OFF -> DndScheduler.disable(context)
    }
  }
}
