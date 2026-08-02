package com.quietloom.app;

import android.media.AudioManager;
import android.os.Bundle;
import android.view.WindowManager;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Belt and braces: the UI still starts the AudioContext from a tap, but this
        // stops the WebView from silently refusing a resume() after a screen-off.
        getBridge().getWebView().getSettings().setMediaPlaybackRequiresUserGesture(false);

        // Route the hardware volume keys to the media stream rather than the ringer.
        setVolumeControlStream(AudioManager.STREAM_MUSIC);

        // Drawing behind the status bar keeps bedside mode fully black.
        getWindow().setFlags(
            WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
            WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS
        );
    }
}
