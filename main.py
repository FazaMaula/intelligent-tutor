from rich.console import Console
from rich.panel import Panel

from tutor.tutor import IntelligentTutor
from logger.session_logger import end_session, log_turn, start_session

console = Console()

COMMANDS = {
    "/baru":    "Mulai sesi belajar baru",
    "/bantuan": "Tampilkan daftar perintah",
    "/laporan": "Tampilkan metrik sesi ini",
    "/keluar":  "Keluar dari program",
}


def show_help():
    lines = "\n".join(
        f"[bold cyan]{cmd}[/]  —  {desc}" for cmd, desc in COMMANDS.items()
    )
    console.print(Panel(lines, title="Perintah Tersedia", border_style="blue"))


def main():
    console.print(
        Panel(
            "[bold green]Selamat datang di Tutor Cerdas![/]\n\n"
            "Hai! Aku [bold]Kak Ajar[/], siap menemani kamu belajar\n"
            "Matematika dan IPA sesuai Kurikulum Merdeka.\n\n"
            "Ketik pertanyaan atau soal yang ingin kamu pelajari.\n"
            "Ketik [bold cyan]/bantuan[/] untuk melihat perintah tersedia.",
            title="Tutor Cerdas",
            border_style="green",
        )
    )

    tutor = IntelligentTutor()
    session_id = start_session(tutor.provider, "cli")
    turn_number = 0

    while True:
        try:
            user_input = console.input("\n[bold yellow]Kamu:[/] ").strip()
        except (KeyboardInterrupt, EOFError):
            console.print("\n[dim]Sampai jumpa! Semangat belajar![/]")
            end_session(session_id)
            break

        if not user_input:
            continue

        if user_input == "/keluar":
            console.print("[dim]Sampai jumpa! Semangat belajar![/]")
            end_session(session_id)
            break
        elif user_input == "/baru":
            end_session(session_id)
            tutor.reset()
            session_id = start_session(tutor.provider, "cli")
            turn_number = 0
            console.print("[dim]Sesi baru dimulai. Mau belajar apa hari ini?[/]")
        elif user_input == "/bantuan":
            show_help()
        elif user_input == "/laporan":
            from analytics.report import print_report
            print_report()
        else:
            turn_number += 1
            log_turn(session_id, turn_number, "user", user_input)

            console.print("\n[bold blue]Kak Ajar:[/] ", end="")
            response = tutor.chat(user_input)

            turn_number += 1
            log_turn(session_id, turn_number, "assistant", response)


if __name__ == "__main__":
    main()
