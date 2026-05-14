from analytics.metrics import compute_metrics


def print_report() -> None:
    m = compute_metrics()
    s, sc, sb = m["sessions"], m["socratic_compliance"], m["student_behavior"]

    print("\n=== LAPORAN METRIK TUTOR CERDAS ===\n")

    print("SESI")
    print(f"  Total sesi              : {s['total']}")
    print(f"  Terselesaikan           : {s['resolved']}  ({s['resolution_rate']:.0%})")
    print(f"  Rata-rata giliran       : {s['avg_turns']}")
    print(f"  Rata-rata (terselesai)  : {s['avg_turns_resolved']}")

    print("\nKEPATUHAN SOCRATIC")
    print(f"  Giliran AI              : {sc['assistant_turns']}")
    print(f"  Patuh                   : {sc['compliant_turns']}  ({sc['compliance_rate']:.0%})")
    print(f"  Pelanggaran             : {sc['violations']}")

    print("\nPERILAKU SISWA")
    print(f"  Giliran siswa           : {sb['user_turns']}")
    print(f"  Minta jawaban langsung  : {sb['answer_requests']}  ({sb['answer_request_rate']:.0%})")

    if m["hint_level_distribution"]:
        labels = {"0": "Eksplorasi", "1": "Kontekstual", "2": "Scaffolding", "3": "Walkthrough"}
        print("\nTANGGA BANTUAN")
        for lvl, count in sorted(m["hint_level_distribution"].items()):
            print(f"  {labels.get(lvl, lvl):<14}: {count}")

    if m["subject_distribution"]:
        print("\nMATA PELAJARAN")
        for subj, count in m["subject_distribution"].items():
            print(f"  {subj:<14}: {count} sesi")

    print()


if __name__ == "__main__":
    print_report()
