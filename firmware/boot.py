# ==============================================================================
# BOOT.PY – TỰ ĐỘNG CHẠY MAIN KHI CẤP NGUỒN (SẴN SÀNG NHẬN LỆNH QUA SERIAL)
# Bấm nút STOP trên Thonny để dừng và vào Shell REPL bất kỳ lúc nào.
# ==============================================================================

try:
    import main
    main.run()
except KeyboardInterrupt:
    print("[Boot] Đã dừng vòng lặp nhận lệnh. Vào chế độ Shell.")
except Exception as e:
    print("[Boot Error]:", e)
