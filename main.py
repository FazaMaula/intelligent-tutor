from rich.console import Console
from rich.panel import Panel

from tutor.tutor import IntelligentTutor

console = Console()

COMMANDS = {
    "/baru": "Mulai sesi belajar baru",
    "/bantuan": "Tampilkan daftar perintah",
    "/keluar": "Keluar dari program",
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

    while True:
        try:
            user_input = console.input("\n[bold yellow]Kamu:[/] ").strip()
        except (KeyboardInterrupt, EOFError):
            console.print("\n[dim]Sampai jumpa! Semangat belajar! 📚[/]")
            break

        if not user_input:
            continue

        if user_input == "/keluar":
            console.print("[dim]Sampai jumpa! Semangat belajar![/]")
            break
        elif user_input == "/baru":
            tutor.reset()
            console.print("[dim]Sesi baru dimulai. Mau belajar apa hari ini?[/]")
        elif user_input == "/bantuan":
            show_help()
        else:
            console.print("\n[bold blue]Kak Ajar:[/] ", end="")
            tutor.chat(user_input)


if __name__ == "__main__":
    main()
