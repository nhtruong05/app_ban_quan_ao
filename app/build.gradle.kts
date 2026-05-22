plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    id("kotlin-parcelize")         // @Parcelize cho Product/Model
    id("kotlin-kapt")              // cần cho Glide compiler
}

android {
    namespace = "com.example.appthoitrang"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.example.appthoitrang"
        minSdk = 24
        targetSdk = 35
        versionCode = 1
        versionName = "1.0"
        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }

    buildTypes {
        debug {
            // Bật logging interceptor ở runtime là đủ; không cần cấu hình đặc biệt ở đây
        }
        release {
            isMinifyEnabled = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }

    buildFeatures {
        viewBinding = true
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
        // Nếu cần desugaring (không bắt buộc ở đây), bật và thêm coreLibraryDesugaring deps:
        // isCoreLibraryDesugaringEnabled = true
    }
    kotlinOptions {
        jvmTarget = "17"
    }

    packaging {
        // Tránh trùng META-INF khi build nhiều lib (hiếm gặp)
        resources {
            excludes += setOf(
                "META-INF/AL2.0",
                "META-INF/LGPL2.1"
            )
        }
    }
}

dependencies {
    // --- AndroidX cơ bản ---
    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.appcompat)
    implementation(libs.material)
    implementation(libs.androidx.activity)
    implementation(libs.androidx.constraintlayout)
    implementation("androidx.fragment:fragment-ktx:1.8.3")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.8.6")
    implementation("androidx.recyclerview:recyclerview:1.3.2")
    implementation("androidx.swiperefreshlayout:swiperefreshlayout:1.1.0")

    // --- Networking / Retrofit stack ---
    implementation("com.squareup.retrofit2:retrofit:2.11.0")
    implementation("com.squareup.retrofit2:converter-gson:2.11.0")
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
    implementation("com.squareup.okhttp3:logging-interceptor:4.12.0")

    // --- Coroutines ---
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.9.0")

    // --- Glide (load ảnh chatbot) ---
    implementation("com.github.bumptech.glide:glide:4.16.0")
    kapt("com.github.bumptech.glide:compiler:4.16.0")
    // (Nếu không dùng Kapt thì thay bằng annotationProcessor, nhưng với Kotlin nên dùng kapt như trên)

    // --- Google Pay / Wallet (nếu dùng) ---
    implementation("com.google.android.gms:play-services-wallet:19.3.0")

    // --- (Tùy chọn) Desugaring nếu bật ở compileOptions ---
    // coreLibraryDesugaring("com.android.tools:desugar_jdk_libs:2.1.2")

    // --- Test ---
    testImplementation(libs.junit)
    androidTestImplementation(libs.androidx.junit)
    androidTestImplementation(libs.androidx.espresso.core)
}
