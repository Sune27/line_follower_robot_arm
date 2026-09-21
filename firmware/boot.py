# ==============================================================================
# BOOT.PY – TỰ ĐỘNG CHẠY MAIN KHI CẤP NGUỒN ESP32
# ==============================================================================

try:
    import main
    if hasattr(main, 'run'):
        main.run()
    elif hasattr(main, 'main'):
        main.main()
except KeyboardInterrupt:
    print("[Boot] Đã dừng vòng lặp.")
except Exception as e:
    print("[Boot Error]:", e)
