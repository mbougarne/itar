package com.itar.adapter

import android.os.SystemClock
import com.facebook.react.bridge.ReactContext
import com.facebook.react.bridge.UIManager
import com.facebook.react.bridge.UIManagerListener
import com.facebook.react.common.annotations.UnstableReactNativeAPI
import com.facebook.react.uimanager.UIManagerHelper

@OptIn(UnstableReactNativeAPI::class)
internal fun SurfaceView.reactMountCommands() = MountCommands(
    lifetime = { if (closed) 0 else connection.lifetime },
    clock = SystemClock::uptimeMillis,
    subscribe = subscribe@{ committed ->
        val react = context as? ReactContext ?: return@subscribe null
        val manager = UIManagerHelper.getUIManagerForReactTag(react, id) ?: return@subscribe null
        val listener = object : UIManagerListener {
            override fun willDispatchViewUpdates(uiManager: UIManager) = Unit
            override fun willMountItems(uiManager: UIManager) = Unit
            override fun didDispatchMountItems(uiManager: UIManager) = Unit
            override fun didScheduleMountItems(uiManager: UIManager) = Unit
            override fun didMountItems(uiManager: UIManager) = committed()
        }
        manager.addUIManagerEventListener(listener)
        val release: () -> Unit = { manager.removeUIManagerEventListener(listener) }
        release
    },
    execute = { command ->
        when (command.kind) {
            MountCommands.Kind.FOCUS -> focusRequest(command.key, command.id, command.at)
            MountCommands.Kind.RESTORE -> restoreScopeRequest(command.key, command.id, command.at)
            MountCommands.Kind.CANCEL -> cancelRequest(command.id)
        }
    },
    reject = { command, status -> emitRequest(longArrayOf(0, status, 0), command) },
    overflow = ::close,
)
