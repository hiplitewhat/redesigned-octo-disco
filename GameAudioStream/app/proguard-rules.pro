# Release builds currently run with minifyEnabled=false, so no custom rules are needed.
# If R8/ProGuard is enabled later, nothing extra is required: the app only uses
# framework audio APIs (android.media.*) and plain java.net sockets, which R8
# handles automatically because they live in the Android runtime.
