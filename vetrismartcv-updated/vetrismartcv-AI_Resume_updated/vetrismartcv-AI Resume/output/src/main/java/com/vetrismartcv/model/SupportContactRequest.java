package com.vetrismartcv.model;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class SupportContactRequest {

    @NotBlank(message = "Please enter your name.")
    @Size(max = 100, message = "Name is too long.")
    @Pattern(regexp = "^[A-Za-z ]+$", message = "Please enter a valid name.")
    private String name;

    @NotBlank(message = "Please enter your email address.")
    @Email(message = "Please enter a valid email address.")
    @Size(max = 150, message = "Email is too long.")
    private String email;

    @NotBlank(message = "Please enter a subject.")
    @Size(min = 3, max = 150, message = "Subject must be between 3 and 150 characters.")
    private String subject;

    @NotBlank(message = "Please enter your message.")
    @Size(min = 20, max = 2000, message = "Your message must be at least 20 characters long.")
    private String message;
}
