from app.core.csrf import is_valid_csrf, new_csrf_token


def test_a_fresh_token_is_valid_when_cookie_and_header_match():
    token = new_csrf_token()
    assert is_valid_csrf(token, token)


def test_every_token_is_different():
    assert new_csrf_token() != new_csrf_token()


def test_missing_cookie_or_header_is_rejected():
    token = new_csrf_token()
    assert not is_valid_csrf(None, token)
    assert not is_valid_csrf(token, None)


def test_cookie_and_header_must_be_the_same_token():
    assert not is_valid_csrf(new_csrf_token(), new_csrf_token())


def test_an_invented_token_is_rejected_even_if_both_match():
    # An attacker who manages to plant a cookie still cannot produce a valid signature.
    forged = "my-own-nonce.0123456789abcdef"
    assert not is_valid_csrf(forged, forged)


def test_a_token_with_a_tampered_signature_is_rejected():
    nonce, _, signature = new_csrf_token().partition(".")
    tampered = f"{nonce}.{signature[:-1]}{'0' if signature[-1] != '0' else '1'}"
    assert not is_valid_csrf(tampered, tampered)
