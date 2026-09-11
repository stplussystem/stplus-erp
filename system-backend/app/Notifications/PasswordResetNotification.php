<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Notification;

class PasswordResetNotification extends Notification
{
    use Queueable;
    public $loginUser;

    public function __construct($loginUser)
    {
        $this->loginUser = $loginUser;
    }

    public function via(object $notifiable): array
    {
        return ['database']; // 💡 ระบุว่าให้เก็บลง Database อย่างเดียว
    }

    public function toDatabase(object $notifiable): array
    {
        return [
            'message' => "ผู้ใช้ {$this->loginUser} แจ้งลืมรหัสผ่าน",
            'type' => 'forgot_password',
            'user' => $this->loginUser
        ];
    }
}
