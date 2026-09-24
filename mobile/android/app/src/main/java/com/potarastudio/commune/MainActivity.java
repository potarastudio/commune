package com.potarastudio.commune;

import android.os.Bundle;
import androidx.core.content.ContextCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // The page's own ground (--bg-main), from values/ or values-night/, so a
        // launch or a reload in dark mode never flashes white before it paints.
        int ground = ContextCompat.getColor(this, R.color.splash_background);
        getBridge().getWebView().setBackgroundColor(ground);
    }
}
